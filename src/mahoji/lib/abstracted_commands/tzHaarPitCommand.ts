import { ButtonBuilder, ButtonStyle, collectSingleInteraction } from '@oldschoolgg/discord';
import { cryptoRng } from '@oldschoolgg/rng/crypto';
import { Bank, toKMB } from 'oldschooljs';
import { chunk } from 'remeda';

import { Time } from '@/lib/constants.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const TILE_PREFIX = 'TZHAAR_PIT_TILE_';
const CASH_OUT_ID = 'TZHAAR_PIT_CASH_OUT';

interface PitTile {
	kind: 'safe' | 'lava';
	revealed: boolean;
}

function buildTiles(): PitTile[] {
	const safeTiles = Array.from({ length: 5 }, () => ({ kind: 'safe', revealed: false }) satisfies PitTile);
	const lavaTiles = Array.from({ length: 6 }, () => ({ kind: 'lava', revealed: false }) satisfies PitTile);
	return cryptoRng.shuffle([...safeTiles, ...lavaTiles]);
}

function multiplierFor(revealedSafe: number) {
	return 1 + revealedSafe * 0.35;
}

function renderButtons(tiles: PitTile[], includeCashOut: boolean, revealAll: boolean) {
	const buttons = tiles.map((tile, index) => {
		const isRevealed = revealAll || tile.revealed;
		const button = new ButtonBuilder().setCustomId(`${TILE_PREFIX}${index}`).setStyle(ButtonStyle.Secondary);

		if (!isRevealed) {
			button.setLabel('???');
		} else if (tile.kind === 'lava') {
			button.setLabel('Lava').setStyle(ButtonStyle.Danger);
		} else {
			button.setLabel('Safe').setStyle(ButtonStyle.Success);
		}

		if (tile.revealed || revealAll) {
			button.setDisabled(true);
		}

		return button;
	});

	const rows = chunk(buttons, 4);
	if (includeCashOut) {
		rows.push([new ButtonBuilder().setLabel('Cash out').setCustomId(CASH_OUT_ID).setStyle(ButtonStyle.Primary)]);
	}
	return rows;
}

function buildStatus(revealedSafe: number) {
	if (revealedSafe === 0) {
		return 'No safe tiles revealed yet. One lava tile ends the run instantly!';
	}
	const multiplier = multiplierFor(revealedSafe);
	return `You revealed ${revealedSafe} safe tile${revealedSafe === 1 ? '' : 's'} for a ${multiplier.toFixed(2)}x multiplier.`;
}

export async function tzHaarPitCommand(user: MUser, interaction: MInteraction, betInput: string | undefined) {
	const amount = mahojiParseNumber({ input: betInput, min: 1_000_000, max: 1_000_000_000 });
	if (!amount) {
		return 'Your bet must be between 1,000,000 and 1,000,000,000.';
	}
	if (user.isIronman) {
		return "Ironmen can't gamble! Go pickpocket some men for GP.";
	}
	if (user.GP < amount) {
		return "You don't have enough GP to make this bet.";
	}

	await interaction.confirmation(
		`Are you sure you want to step into the TzHaar Pit with a ${toKMB(amount)} bet? Lava tiles wipe the entire stake, but you can cash out any time.`
	);

	await user.sync();
	if (user.GP < amount) {
		return "You don't have enough GP to make this bet.";
	}
	await user.removeItemsFromBank(new Bank().add('Coins', amount));

	const tiles = buildTiles();
	let revealedSafe = 0;
	let finished = false;
	let lostToLava = false;

	const response = await interaction.replyWithResponse({
		content: `${user}, pick a tile to begin. ${buildStatus(revealedSafe)}`,
		components: renderButtons(tiles, true, false),
		withResponse: true
	});

	if (!response?.message_id) {
		return 'Something went wrong starting the pit run.';
	}

	while (!finished) {
		const selection = await collectSingleInteraction({
			interaction,
			messageId: response.message_id,
			channelId: interaction.channelId,
			users: [interaction.userId],
			timeoutMs: Time.Second * 45
		});

		if (!selection) {
			const timeoutMultiplier = multiplierFor(revealedSafe);
			const winnings = revealedSafe === 0 ? amount : Math.floor(amount * timeoutMultiplier);
			const netChange = winnings - amount;
			if (winnings > 0) {
				await user.addItemsToBank({ items: new Bank().add('Coins', winnings) });
			}
			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', netChange);
			await user.updateGPTrackSetting('gp_tzhaarpit', netChange);
			await interaction.editReply({
				content:
					revealedSafe === 0
						? `${user}, you didn't pick in time. Your ${toKMB(amount)} bet was refunded.`
						: `${user}, you timed out but cashed out automatically at ${timeoutMultiplier.toFixed(2)}x for ${toKMB(winnings)}.`,
				components: renderButtons(tiles, false, true)
			});
			return;
		}

		selection.silentButtonAck();

		if (selection.customId === CASH_OUT_ID) {
			const multiplier = multiplierFor(revealedSafe);
			const winnings = Math.floor(amount * multiplier);
			const netChange = winnings - amount;
			if (winnings > 0) {
				await user.addItemsToBank({ items: new Bank().add('Coins', winnings) });
			}
			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', netChange);
			await user.updateGPTrackSetting('gp_tzhaarpit', netChange);
			await interaction.editReply({
				content: `${user} cashed out at ${multiplier.toFixed(2)}x for ${toKMB(winnings)}!`,
				components: renderButtons(tiles, false, true)
			});
			finished = true;
			continue;
		}

		const tileIndex = Number(selection.customId?.replace(TILE_PREFIX, ''));
		const tile = tiles[tileIndex];
		if (!tile || tile.revealed) {
			continue;
		}

		tile.revealed = true;
		if (tile.kind === 'lava') {
			lostToLava = true;
			finished = true;
			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', -amount);
			await user.updateGPTrackSetting('gp_tzhaarpit', -amount);
			await interaction.editReply({
				content: `${user} hit a lava tile and lost their ${toKMB(amount)} bet!`,
				components: renderButtons(tiles, false, true)
			});
			continue;
		}

		revealedSafe += 1;
		const multiplier = multiplierFor(revealedSafe);
		const safeTilesRemaining = tiles.filter(t => t.kind === 'safe' && !t.revealed).length;
		if (safeTilesRemaining === 0) {
			const winnings = Math.floor(amount * multiplier);
			const netChange = winnings - amount;
			await user.addItemsToBank({ items: new Bank().add('Coins', winnings) });
			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', netChange);
			await user.updateGPTrackSetting('gp_tzhaarpit', netChange);
			await interaction.editReply({
				content: `${user} cleared every safe tile and escaped with ${toKMB(winnings)} at ${multiplier.toFixed(2)}x!`,
				components: renderButtons(tiles, false, true)
			});
			finished = true;
			continue;
		}

		await interaction.editReply({
			content: `${user}, ${buildStatus(revealedSafe)} Pick another tile or cash out!`,
			components: renderButtons(tiles, true, false)
		});
	}

	if (!lostToLava && !tiles.some(t => t.revealed && t.kind === 'lava')) {
		return `${user} left the pit.`;
	}

	return null;
}
