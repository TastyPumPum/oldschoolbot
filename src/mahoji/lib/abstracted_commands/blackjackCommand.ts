import { ButtonBuilder, ButtonStyle, EmbedBuilder, SpecialResponse } from '@oldschoolgg/discord';
import { cryptoRng } from '@oldschoolgg/rng/crypto';
import { Bank, toKMB } from 'oldschooljs';
import { chunk } from 'remeda';

import {
	advanceToNextHand,
	applyDouble,
	applyHit,
	applySplit,
	applyStand,
	type BlackjackHand,
	type BlackjackState,
	canDoubleHand,
	canSplitHand,
	createInitialState,
	type HandOutcome,
	handValue,
	resolveDealerTurn,
	resolveInsurance,
	settleGame,
	startInitialDeal
} from '@/lib/blackjack/engine.js';
import {
	activeBlackjackGames,
	BLACKJACK_TIMEOUT_MS,
	type BlackjackGame,
	blackjackTimeouts,
	clearBlackjackGame
} from '@/lib/blackjack/state.js';
import { userQueueFn } from '@/lib/util/userQueues.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const BLACKJACK_TIMEOUT_NOTICE = `Auto-stand after ${Math.floor(BLACKJACK_TIMEOUT_MS / 1000)} seconds of inactivity.`;

function formatCard(card: { rank: string; suit: string }) {
	return `${card.rank}${card.suit}`;
}

function formatOutcome(outcome: HandOutcome | undefined): string {
	switch (outcome) {
		case 'blackjack':
			return 'Blackjack';
		case 'win':
			return 'Win';
		case 'lose':
			return 'Lose';
		case 'push':
			return 'Push';
		case 'bust':
			return 'Bust';
		default:
			return '';
	}
}

function buildHandLine(hand: BlackjackHand, index: number, isCurrent: boolean): string {
	const value = handValue(hand.cards, { canBeBlackjack: hand.canBeBlackjack });
	const totalLabel = value.total > 21 ? `${value.total} (Bust)` : `${value.total}${value.isSoft ? ' (Soft)' : ''}`;
	const outcome = formatOutcome(hand.outcome);
	const header = hand.cards.length > 0 ? hand.cards.map(formatCard).join(' ') : 'No cards';
	const pointer = isCurrent ? '👉 ' : '';
	const handLabel = `Hand ${index + 1}`;
	return `${pointer}**${handLabel}** [${header}] — ${totalLabel} — Bet: ${toKMB(hand.bet)}${
		outcome ? ` — ${outcome}` : ''
	}`;
}

function buildDealerLine(state: BlackjackState, revealDealer: boolean): string {
	if (state.dealerHand.length === 0) return 'Dealer: (waiting)';
	if (!revealDealer) {
		const upcard = formatCard(state.dealerHand[0]);
		return `Dealer: ${upcard} 🂠`;
	}
	const value = handValue(state.dealerHand, { canBeBlackjack: true });
	return `Dealer: ${state.dealerHand.map(formatCard).join(' ')} — ${value.total}${value.isSoft ? ' (Soft)' : ''}`;
}

function buildBlackjackEmbed(game: BlackjackGame, notice?: string): EmbedBuilder {
	const revealDealer = game.phase === 'DEALER_TURN' || game.phase === 'SETTLEMENT' || game.phase === 'COMPLETE';
	const dealerLine = buildDealerLine(game, revealDealer);
	const hands = game.playerHands
		.map((hand, index) =>
			buildHandLine(hand, index, game.phase === 'PLAYER_TURN' && index === game.currentHandIndex)
		)
		.join('\n');

	const embed = new EmbedBuilder().setTitle('Blackjack').setDescription([dealerLine, '', hands].join('\n'));

	const betLines = [`Main Bet: ${toKMB(game.mainBet)}`];
	if (game.insuranceBet > 0) {
		betLines.push(`Insurance Bet: ${toKMB(game.insuranceBet)}`);
	}

	for (const [index, hand] of game.playerHands.entries()) {
		const modifiers = [];
		if (hand.doubled) modifiers.push('Doubled');
		if (hand.isSplitAcesHand) modifiers.push('Split Aces');
		betLines.push(
			`Hand ${index + 1} Bet: ${toKMB(hand.bet)}${modifiers.length ? ` (${modifiers.join(', ')})` : ''}`
		);
	}

	embed.addFields({ name: 'Bets', value: betLines.join('\n') });

	if (notice) {
		embed.addFields({ name: 'Notice', value: notice });
	}

	if (game.phase === 'SETTLEMENT' || game.phase === 'COMPLETE') {
		embed.setFooter({ text: 'Game complete.' });
	} else if (game.phase === 'INSURANCE_OFFER') {
		embed.setFooter({ text: 'Insurance offered.' });
	} else {
		embed.setFooter({ text: BLACKJACK_TIMEOUT_NOTICE });
	}

	return embed;
}

function buildBlackjackComponents(game: BlackjackGame): ButtonBuilder[][] {
	if (game.phase === 'INSURANCE_OFFER') {
		return [
			[
				new ButtonBuilder()
					.setCustomId(`BJ|INSURE|${game.nonce}`)
					.setLabel('Take Insurance')
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId(`BJ|NO_INSURE|${game.nonce}`)
					.setLabel('No Insurance')
					.setStyle(ButtonStyle.Primary)
			]
		];
	}

	if (game.phase !== 'PLAYER_TURN') return [];
	const buttons: ButtonBuilder[] = [
		new ButtonBuilder().setCustomId(`BJ|HIT|${game.nonce}`).setLabel('Hit').setStyle(ButtonStyle.Primary),
		new ButtonBuilder().setCustomId(`BJ|STAND|${game.nonce}`).setLabel('Stand').setStyle(ButtonStyle.Secondary)
	];

	if (canDoubleHand(game)) {
		buttons.push(
			new ButtonBuilder().setCustomId(`BJ|DOUBLE|${game.nonce}`).setLabel('Double').setStyle(ButtonStyle.Success)
		);
	}

	if (canSplitHand(game)) {
		buttons.push(
			new ButtonBuilder().setCustomId(`BJ|SPLIT|${game.nonce}`).setLabel('Split').setStyle(ButtonStyle.Danger)
		);
	}

	return chunk(buttons, 5);
}

function buildBlackjackMessage(game: BlackjackGame, notice?: string) {
	return {
		embeds: [buildBlackjackEmbed(game, notice)],
		components: buildBlackjackComponents(game)
	};
}

function scheduleBlackjackTimeout(game: BlackjackGame) {
	if (game.phase !== 'INSURANCE_OFFER' && game.phase !== 'PLAYER_TURN') return;
	const existing = blackjackTimeouts.get(game.userId);
	if (existing) clearTimeout(existing);
	game.timeoutAt = Date.now() + BLACKJACK_TIMEOUT_MS;
	const timeout = setTimeout(() => {
		handleBlackjackTimeout(game.userId, game.nonce).catch(err => Logging.logError(err as Error));
	}, BLACKJACK_TIMEOUT_MS);
	blackjackTimeouts.set(game.userId, timeout);
}

function needsDealerTurn(game: BlackjackGame): boolean {
	return !game.dealerHasBlackjack;
}

async function settleAndPayout(game: BlackjackGame, user: MUser, playDealer: boolean) {
	if (playDealer) {
		resolveDealerTurn(game);
	}
	const { totalPayout } = settleGame(game);
	if (totalPayout > 0) {
		await user.transactItems({ itemsToAdd: new Bank().add('Coins', totalPayout), collectionLog: false });
	}
	game.phase = 'COMPLETE';
	clearBlackjackGame(user.id);
	return totalPayout;
}

function activeHand(game: BlackjackGame): BlackjackHand {
	return game.playerHands[game.currentHandIndex];
}

export async function blackjackCommand(interaction: MInteraction, user: MUser, amountInput?: string) {
	if (user.isIronman) {
		return "Ironmen can't gamble! Go pickpocket some men for GP.";
	}
	const amount = mahojiParseNumber({ input: amountInput, min: 1, max: 500_000_000_000 });
	if (!amount || !Number.isInteger(amount)) {
		return 'You must provide a valid amount of GP to bet.';
	}

	return userQueueFn(user.id, async () => {
		if (activeBlackjackGames.has(user.id)) {
			return 'You already have an active Blackjack game. Finish it before starting another.';
		}

		await interaction.confirmation(`Are you sure you want to gamble ${toKMB(amount)}?`);
		await user.sync();
		if (user.GP < amount) {
			return "You don't have enough GP to make this bet.";
		}

		await user.transactItems({ itemsToRemove: new Bank().add('Coins', amount) });

		const state = createInitialState({ mainBet: amount });
		startInitialDeal(state);
		const game: BlackjackGame = {
			...state,
			userId: user.id,
			channelId: interaction.channelId ?? null,
			messageId: null,
			nonce: cryptoRng.randInt(1, 9_999_999_999).toString(),
			createdAt: Date.now()
		};

		let notice: string | undefined;
		if (game.phase === 'SETTLEMENT') {
			await settleAndPayout(game, user, false);
			notice = 'Blackjack resolved immediately.';
		} else {
			activeBlackjackGames.set(user.id, game);
			scheduleBlackjackTimeout(game);
		}

		const response = buildBlackjackMessage(game, notice);
		const message = await interaction.replyWithResponse(response);
		game.messageId = message?.message_id ?? null;
		if (game.phase !== 'COMPLETE' && game.phase !== 'SETTLEMENT') {
			activeBlackjackGames.set(user.id, game);
		}

		return SpecialResponse.RespondedManually;
	});
}

export async function handleBlackjackButton(interaction: MInteraction, customId: string) {
	const [prefix, action, nonce] = customId.split('|');
	if (prefix !== 'BJ' || !action || !nonce) {
		return { content: 'Invalid Blackjack interaction.', ephemeral: true };
	}

	const userId = interaction.userId;
	return userQueueFn(userId, async () => {
		const game = activeBlackjackGames.get(userId);
		if (!game) {
			await interaction.reply({ content: 'You do not have an active Blackjack game.', ephemeral: true });
			return SpecialResponse.RespondedManually;
		}
		if (game.nonce !== nonce) {
			await interaction.reply({ content: 'This Blackjack game is no longer active.', ephemeral: true });
			return SpecialResponse.RespondedManually;
		}

		const user = await mUserFetch(userId);
		await user.sync();

		let notice: string | undefined;
		if (game.phase === 'INSURANCE_OFFER') {
			if (action !== 'INSURE' && action !== 'NO_INSURE') {
				await interaction.reply({
					content: 'Insurance is pending. Please respond to the insurance offer.',
					ephemeral: true
				});
				return SpecialResponse.RespondedManually;
			}
			if (action === 'INSURE') {
				const insuranceBet = Math.floor(game.mainBet / 2);
				if (insuranceBet === 0) {
					await interaction.reply({
						content: 'Insurance is not available for this bet size.',
						ephemeral: true
					});
					return SpecialResponse.RespondedManually;
				}
				if (user.GP < insuranceBet) {
					await interaction.reply({
						content: 'You do not have enough GP to take insurance.',
						ephemeral: true
					});
					return SpecialResponse.RespondedManually;
				}
				await user.transactItems({ itemsToRemove: new Bank().add('Coins', insuranceBet) });
				resolveInsurance(game, true);
			} else {
				resolveInsurance(game, false);
			}
			if (game.phase === 'SETTLEMENT') {
				await settleAndPayout(game, user, false);
				notice = notice ?? (game.dealerHasBlackjack ? 'Dealer has blackjack.' : 'Blackjack resolved.');
			}
		} else if (game.phase === 'PLAYER_TURN') {
			const hand = activeHand(game);
			if (hand.isSplitAcesHand) {
				await interaction.reply({ content: 'Split aces cannot take actions.', ephemeral: true });
				return SpecialResponse.RespondedManually;
			}

			switch (action) {
				case 'HIT':
					applyHit(game);
					break;
				case 'STAND':
					applyStand(game);
					break;
				case 'DOUBLE': {
					if (!canDoubleHand(game)) {
						await interaction.reply({ content: 'Double is not available for this hand.', ephemeral: true });
						return SpecialResponse.RespondedManually;
					}
					const additionalBet = hand.bet;
					if (user.GP < additionalBet) {
						await interaction.reply({ content: 'You do not have enough GP to double.', ephemeral: true });
						return SpecialResponse.RespondedManually;
					}
					await user.transactItems({ itemsToRemove: new Bank().add('Coins', additionalBet) });
					applyDouble(game);
					break;
				}
				case 'SPLIT': {
					if (!canSplitHand(game)) {
						await interaction.reply({ content: 'Split is not available for this hand.', ephemeral: true });
						return SpecialResponse.RespondedManually;
					}
					if (user.GP < game.mainBet) {
						await interaction.reply({ content: 'You do not have enough GP to split.', ephemeral: true });
						return SpecialResponse.RespondedManually;
					}
					await user.transactItems({ itemsToRemove: new Bank().add('Coins', game.mainBet) });
					applySplit(game);
					break;
				}
				default:
					await interaction.reply({ content: 'That action is not available right now.', ephemeral: true });
					return SpecialResponse.RespondedManually;
			}
		} else {
			await interaction.reply({
				content: 'This Blackjack game is no longer accepting actions.',
				ephemeral: true
			});
			return SpecialResponse.RespondedManually;
		}

		if (game.phase === 'PLAYER_TURN') {
			const currentHand = activeHand(game);
			if (currentHand.isComplete) {
				if (!advanceToNextHand(game)) {
					await settleAndPayout(game, user, needsDealerTurn(game));
					notice = 'Hand finished. Dealer plays out.';
				}
			}
		}

		if (game.phase === 'PLAYER_TURN') {
			scheduleBlackjackTimeout(game);
		}

		const message = buildBlackjackMessage(game, notice);
		await interaction.update(message);
		return SpecialResponse.RespondedManually;
	});
}

async function handleBlackjackTimeout(userId: string, nonce: string) {
	await userQueueFn(userId, async () => {
		const game = activeBlackjackGames.get(userId);
		if (!game || game.nonce !== nonce) return;
		const user = await mUserFetch(userId);

		let notice = 'Timed out: auto-stand applied.';
		if (game.phase === 'INSURANCE_OFFER') {
			resolveInsurance(game, false);
			notice = 'Timed out: insurance declined.';
		} else if (game.phase === 'PLAYER_TURN') {
			applyStand(game);
			if (!advanceToNextHand(game)) {
				await settleAndPayout(game, user, needsDealerTurn(game));
				notice = 'Timed out: dealer plays out.';
			}
		}

		if (game.phase === 'SETTLEMENT') {
			await settleAndPayout(game, user, false);
			notice = game.dealerHasBlackjack ? 'Timed out: dealer has blackjack.' : 'Timed out: blackjack resolved.';
		}

		if (game.phase === 'PLAYER_TURN') {
			scheduleBlackjackTimeout(game);
		}

		if (!game.channelId || !game.messageId) return;
		await globalClient.editMessage(game.channelId, game.messageId, buildBlackjackMessage(game, notice));
	});
}
