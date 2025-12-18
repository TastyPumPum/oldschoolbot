import { ButtonBuilder, ButtonStyle, collectSingleInteraction, SpecialResponse } from '@oldschoolgg/discord';
import { cryptoRng } from '@oldschoolgg/rng/crypto';
import { Time } from '@oldschoolgg/toolkit';
import { Bank, toKMB } from 'oldschooljs';
import { chunk } from 'remeda';

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

// FIX: Lowered from 0.35 to reduce +EV "one click then cash" behaviour.
const MULT_STEP = 0.22;

// FIX: Require at least 2 safe reveals before cashout.
const MIN_SAFES_TO_CASHOUT = 2;

function multiplierFor(revealedSafe: number) {
	return 1 + revealedSafe * MULT_STEP;
}

// TS shim: your runtime interaction wrapper supports editReply, but the type here doesn't.
type EditReplyFn = (opts: { content?: string; components?: any }) => Promise<any>;
function getEditReply(interaction: MInteraction): EditReplyFn {
	return (interaction as unknown as { editReply: EditReplyFn }).editReply;
}

function renderButtons(tiles: PitTile[], includeCashOut: boolean, revealAll: boolean) {
	const buttons: ButtonBuilder[] = tiles.map((tile, index) => {
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

	// TS FIX: remeda chunk types can be readonly/tuple-y; force it to ButtonBuilder[][]
	const baseRows = chunk(buttons, 4).map(row => [...row]) as ButtonBuilder[][];

	if (!includeCashOut) return baseRows;

	const cashOutRow: ButtonBuilder[] = [
		new ButtonBuilder().setLabel('Cash out').setCustomId(CASH_OUT_ID).setStyle(ButtonStyle.Primary)
	];

	return [...baseRows, cashOutRow];
}

function buildStatus(revealedSafe: number) {
	if (revealedSafe === 0) {
		return `No safe tiles revealed yet. One lava tile ends the run instantly! Cash out unlocks after ${MIN_SAFES_TO_CASHOUT} safes.`;
	}
	const multiplier = multiplierFor(revealedSafe);
	return `You revealed ${revealedSafe} safe tile${revealedSafe === 1 ? '' : 's'} for a ${multiplier.toFixed(
		2
	)}x multiplier. Cash out unlocks after ${MIN_SAFES_TO_CASHOUT} safes.`;
}

export async function tzHaarPitCommand(
	user: MUser,
	interaction: MInteraction,
	betInput: string | undefined
): Promise<string | SpecialResponse> {
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
		`Are you sure you want to step into the TzHaar Pit with a ${toKMB(amount)} bet? Lava tiles wipe the entire stake. Cash out unlocks after ${MIN_SAFES_TO_CASHOUT} safe tiles.`
	);

	await user.sync();
	if (user.GP < amount) {
		return "You don't have enough GP to make this bet.";
	}
	await user.removeItemsFromBank(new Bank().add('Coins', amount));

	const editReply = getEditReply(interaction);

	const tiles = buildTiles();
	let revealedSafe = 0;
	let finished = false;

	const response = await interaction.replyWithResponse({
		content: `${user}, pick a tile to begin. ${buildStatus(revealedSafe)}`,
		// Cashout locked initially:
		components: renderButtons(tiles, false, false),
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

		// FIX: timeout is a LOSS. No refunds. No auto-cash.
		if (!selection) {
			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', -amount);
			await user.updateGPTrackSetting('gp_tzhaarpit', -amount);

			await editReply({
				content: `${user}, you hesitated too long and the lava rose… you lost your ${toKMB(amount)} bet.`,
				components: renderButtons(tiles, false, true)
			});
			return SpecialResponse.RespondedManually;
		}

		selection.silentButtonAck();

		// CASH OUT
		if (selection.customId === CASH_OUT_ID) {
			// Enforce minimum safes (button shouldn't appear early, but keep server-side check anyway)
			if (revealedSafe < MIN_SAFES_TO_CASHOUT) {
				await editReply({
					content: `${user}, you need at least ${MIN_SAFES_TO_CASHOUT} safe tiles revealed before you can cash out. ${buildStatus(
						revealedSafe
					)}`,
					components: renderButtons(tiles, false, false)
				});
				continue;
			}

			const multiplier = multiplierFor(revealedSafe);
			const winnings = Math.floor(amount * multiplier);
			const netChange = winnings - amount;

			if (winnings > 0) {
				await user.addItemsToBank({ items: new Bank().add('Coins', winnings) });
			}

			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', netChange);
			await user.updateGPTrackSetting('gp_tzhaarpit', netChange);

			await editReply({
				content: `${user} cashed out at ${multiplier.toFixed(2)}x for ${toKMB(winnings)}!`,
				components: renderButtons(tiles, false, true)
			});

			finished = true;
			continue;
		}

		// TILE PICK
		const tileIndex = Number(selection.customId?.replace(TILE_PREFIX, ''));
		const tile = tiles[tileIndex];
		if (!tile || tile.revealed) {
			continue;
		}

		tile.revealed = true;

		// HIT LAVA = LOSE
		if (tile.kind === 'lava') {
			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', -amount);
			await user.updateGPTrackSetting('gp_tzhaarpit', -amount);

			await editReply({
				content: `${user} hit a lava tile and lost their ${toKMB(amount)} bet!`,
				components: renderButtons(tiles, false, true)
			});

			finished = true;
			continue;
		}

		// SAFE TILE
		revealedSafe += 1;
		const multiplier = multiplierFor(revealedSafe);

		const safeTilesRemaining = tiles.filter(t => t.kind === 'safe' && !t.revealed).length;

		// All safes cleared = auto win
		if (safeTilesRemaining === 0) {
			const winnings = Math.floor(amount * multiplier);
			const netChange = winnings - amount;

			await user.addItemsToBank({ items: new Bank().add('Coins', winnings) });
			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', netChange);
			await user.updateGPTrackSetting('gp_tzhaarpit', netChange);

			await editReply({
				content: `${user} cleared every safe tile and escaped with ${toKMB(winnings)} at ${multiplier.toFixed(2)}x!`,
				components: renderButtons(tiles, false, true)
			});

			finished = true;
			continue;
		}

		// Show cashout button only once unlocked
		const canCashOut = revealedSafe >= MIN_SAFES_TO_CASHOUT;

		await editReply({
			content: `${user}, ${buildStatus(revealedSafe)} Pick another tile${canCashOut ? ' or cash out' : ''}!`,
			components: renderButtons(tiles, canCashOut, false)
		});
	}

	return SpecialResponse.RespondedManually;
}
