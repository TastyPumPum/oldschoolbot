import type { ButtonMInteraction } from '@oldschoolgg/discord';
import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';
import { Bank, toKMB } from 'oldschooljs';
import { chunk } from 'remeda';

import { globalConfig } from '@/constants.js';
import {
	bumpPitExpiry,
	deletePitState,
	getPitState,
	isPitExpired
} from '../../../../src/mahoji/lib/abstracted_commands/tzHaarPitGambleState.js';

const PIT_PREFIX = 'TZHAAR_PIT|';
const CONFIRM_ID = `${PIT_PREFIX}CONFIRM`;
const CANCEL_ID = `${PIT_PREFIX}CANCEL`;
const CASH_ID = `${PIT_PREFIX}CASH`;
const QUIT_ID = `${PIT_PREFIX}QUIT`;
const TILE_PREFIX = `${PIT_PREFIX}TILE|`;

// Same balance settings as your command:
const MULT_STEP = 0.22;
const MIN_SAFES_TO_CASHOUT = 2;

function multiplierFor(revealedSafe: number) {
	return 1 + revealedSafe * MULT_STEP;
}

function buildStatus(revealedSafe: number) {
	if (revealedSafe === 0) {
		return `No safe tiles revealed yet. One lava tile ends the run instantly! Cash out unlocks after ${MIN_SAFES_TO_CASHOUT} safes.`;
	}
	const mult = multiplierFor(revealedSafe);
	return `You revealed ${revealedSafe} safe tile${revealedSafe === 1 ? '' : 's'} for a ${mult.toFixed(
		2
	)}x multiplier. Cash out unlocks after ${MIN_SAFES_TO_CASHOUT} safes.`;
}

function renderButtons(
	tiles: { kind: 'safe' | 'lava'; revealed: boolean }[],
	includeCashOut: boolean,
	revealAll: boolean
) {
	const buttons = tiles.map((tile, index) => {
		const isRevealed = revealAll || tile.revealed;

		const b = new ButtonBuilder().setCustomId(`${TILE_PREFIX}${index}`).setStyle(ButtonStyle.Secondary);

		if (!isRevealed) {
			b.setLabel('???');
		} else if (tile.kind === 'lava') {
			b.setLabel('Lava').setStyle(ButtonStyle.Danger);
		} else {
			b.setLabel('Safe').setStyle(ButtonStyle.Success);
		}

		if (tile.revealed || revealAll) b.setDisabled(true);
		return b;
	});

	const rows = chunk(buttons, 4).map(r => [...r]) as ButtonBuilder[][];
	const controlRow: ButtonBuilder[] = [];

	if (includeCashOut) {
		controlRow.push(new ButtonBuilder().setCustomId(CASH_ID).setStyle(ButtonStyle.Primary).setLabel('Cash out'));
	}

	controlRow.push(new ButtonBuilder().setCustomId(QUIT_ID).setStyle(ButtonStyle.Secondary).setLabel('Quit'));

	rows.push(controlRow);
	return rows;
}

function renderConfirmButtons() {
	return [
		[
			new ButtonBuilder().setCustomId(CONFIRM_ID).setStyle(ButtonStyle.Success).setLabel('Confirm'),
			new ButtonBuilder().setCustomId(CANCEL_ID).setStyle(ButtonStyle.Danger).setLabel('Cancel')
		]
	];
}

function getMessageId(interaction: ButtonMInteraction) {
	// Your wrapper likely exposes one of these:
	return (interaction as any).messageId ?? (interaction as any).message?.id;
}

export async function handleButtonInteraction(interaction: ButtonMInteraction) {
	const id = interaction.customId;
	if (!id) return;

	// ===========================
	// TZHAAR PIT (GLOBAL)
	// ===========================
	if (id.startsWith(PIT_PREFIX)) {
		const messageId = getMessageId(interaction);
		if (!messageId) {
			return interaction.reply({ content: 'Could not resolve game message.', ephemeral: true });
		}

		const state = getPitState(messageId);
		if (!state) {
			return interaction.reply({ content: 'This game has already ended.', ephemeral: true });
		}

		// Only the owner can play
		if (interaction.userId !== state.userId) {
			return interaction.reply({ content: "This isn't your pit run.", ephemeral: true });
		}

		// Expiry handling (lazy): if expired, treat as loss once they interact again
		if (isPitExpired(state) && state.phase === 'playing') {
			const amount = state.amount;
			const user = await mUserFetch(interaction.userId);

			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', -amount);
			await user.updateGPTrackSetting('gp_tzhaarpit', -amount);

			deletePitState(messageId);

			return interaction.update({
				content: `${user}, you took too long and the lava rose… you lost your ${toKMB(amount)} bet.`,
				components: renderButtons(state.tiles, false, true)
			});
		}

		bumpPitExpiry(state);

		// CONFIRM / CANCEL
		if (id === CANCEL_ID) {
			deletePitState(messageId);
			return interaction.update({
				content: `<@${state.userId}> decided not to enter the TzHaar Pit.`,
				components: []
			});
		}

		if (id === CONFIRM_ID) {
			const user = await mUserFetch(interaction.userId);

			// Take GP under lock, then switch to playing
			await user
				.withLock('tzhaar_pit_bet', async () => {
					await user.sync();
					if (user.GP < state.amount) {
						throw new Error('Not enough GP');
					}
					await user.removeItemsFromBank(new Bank().add('Coins', state.amount));
				})
				.catch(async () => {
					deletePitState(messageId);
					return interaction.update({
						content: `${user}, you don't have enough GP to make this bet anymore.`,
						components: []
					});
				});

			// If the above catch ran, we already returned via update (but TS can’t see it). Re-check:
			const stillThere = getPitState(messageId);
			if (!stillThere) return;

			state.phase = 'playing';

			return interaction.update({
				content: `${user}, pick a tile to begin. ${buildStatus(0)}`,
				components: renderButtons(state.tiles, false, false)
			});
		}

		// QUIT (forfeits stake)
		if (id === QUIT_ID) {
			if (state.phase !== 'playing') {
				deletePitState(messageId);
				return interaction.update({ content: `<@${state.userId}> cancelled the pit run.`, components: [] });
			}

			const user = await mUserFetch(interaction.userId);
			await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', -state.amount);
			await user.updateGPTrackSetting('gp_tzhaarpit', -state.amount);

			deletePitState(messageId);

			return interaction.update({
				content: `${user} bailed out… and lost their ${toKMB(state.amount)} bet.`,
				components: renderButtons(state.tiles, false, true)
			});
		}

		// CASH OUT
		if (id === CASH_ID) {
			if (state.phase !== 'playing') {
				return interaction.reply({ content: 'This game is not active.', ephemeral: true });
			}

			const revealedSafe = state.tiles.filter(t => t.kind === 'safe' && t.revealed).length;
			if (revealedSafe < MIN_SAFES_TO_CASHOUT) {
				return interaction.reply({
					content: `You need at least ${MIN_SAFES_TO_CASHOUT} safe tiles before cashing out.`,
					ephemeral: true
				});
			}

			const user = await mUserFetch(interaction.userId);
			const mult = multiplierFor(revealedSafe);
			const winnings = Math.floor(state.amount * mult);
			const netChange = winnings - state.amount;

			await user.withLock('tzhaar_pit_settle', async () => {
				await user.addItemsToBank({ items: new Bank().add('Coins', winnings) });
				await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', netChange);
				await user.updateGPTrackSetting('gp_tzhaarpit', netChange);
			});

			deletePitState(messageId);

			return interaction.update({
				content: `${user} cashed out at ${mult.toFixed(2)}x for ${toKMB(winnings)}!`,
				components: renderButtons(state.tiles, false, true)
			});
		}

		// TILE CLICK
		if (id.startsWith(TILE_PREFIX)) {
			if (state.phase !== 'playing') {
				return interaction.reply({ content: 'Confirm first.', ephemeral: true });
			}

			const idx = Number(id.slice(TILE_PREFIX.length));
			const tile = state.tiles[idx];
			if (!tile) return interaction.reply({ content: 'Invalid tile.', ephemeral: true });
			if (tile.revealed) return interaction.reply({ content: 'That tile is already revealed.', ephemeral: true });

			tile.revealed = true;

			const user = await mUserFetch(interaction.userId);

			// Lava => lose
			if (tile.kind === 'lava') {
				await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', -state.amount);
				await user.updateGPTrackSetting('gp_tzhaarpit', -state.amount);

				deletePitState(messageId);

				return interaction.update({
					content: `${user} hit a lava tile and lost their ${toKMB(state.amount)} bet!`,
					components: renderButtons(state.tiles, false, true)
				});
			}

			// Safe
			const revealedSafe = state.tiles.filter(t => t.kind === 'safe' && t.revealed).length;
			const mult = multiplierFor(revealedSafe);

			const safeRemaining = state.tiles.filter(t => t.kind === 'safe' && !t.revealed).length;
			if (safeRemaining === 0) {
				const winnings = Math.floor(state.amount * mult);
				const netChange = winnings - state.amount;

				await user.withLock('tzhaar_pit_settle', async () => {
					await user.addItemsToBank({ items: new Bank().add('Coins', winnings) });
					await ClientSettings.updateClientGPTrackSetting('gp_tzhaarpit', netChange);
					await user.updateGPTrackSetting('gp_tzhaarpit', netChange);
				});

				deletePitState(messageId);

				return interaction.update({
					content: `${user} cleared every safe tile and escaped with ${toKMB(winnings)} at ${mult.toFixed(2)}x!`,
					components: renderButtons(state.tiles, false, true)
				});
			}

			const canCash = revealedSafe >= MIN_SAFES_TO_CASHOUT;

			return interaction.update({
				content: `${user}, you found a safe tile. Current multiplier: ${mult.toFixed(2)}x.\n${buildStatus(revealedSafe)}`,
				components: renderButtons(state.tiles, canCash, false)
			});
		}

		// Unknown pit button
		return interaction.reply({ content: 'Unknown pit action.', ephemeral: true });
	}

	// ===========================
	// SUPPORT SERVER ROLE BUTTONS (KEEP GATED)
	// ===========================
	const member = await globalClient.fetchMember({
		guildId: globalConfig.supportServerID,
		userId: interaction.userId
	});
	if (!member) return;

	if (id.includes('roles.')) {
		const roleID = id.split('_')[1];
		const pingableRole = await roboChimpClient.pingableRole.findFirst({
			where: {
				role_id: roleID
			}
		});
		if (!pingableRole) return;

		if (id.includes('add')) {
			if (member.roles.includes(pingableRole.role_id)) {
				return interaction.reply({ content: 'You already have this role.', ephemeral: true });
			}
			try {
				await globalClient.giveRole(globalConfig.supportServerID, interaction.userId, pingableRole.role_id);
				return interaction.reply({
					content: `Gave you the \`${pingableRole.name}\` role.`,
					ephemeral: true
				});
			} catch {
				return interaction.reply({
					content: 'An error occured trying to give you the role.',
					ephemeral: true
				});
			}
		} else {
			if (!member.roles.includes(pingableRole.role_id)) {
				return interaction.reply({ content: "You don't have this role.", ephemeral: true });
			}
			try {
				await globalClient.takeRole(globalConfig.supportServerID, interaction.userId, pingableRole.role_id);
				return interaction.reply({
					content: `Removed the \`${pingableRole.name}\` role from you.`,
					ephemeral: true
				});
			} catch {
				return interaction.reply({
					content: 'An error occured trying to remove the role.',
					ephemeral: true
				});
			}
		}
	}
}
