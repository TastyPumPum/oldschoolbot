import { ButtonBuilder, ButtonStyle, EmbedBuilder, SpecialResponse } from '@oldschoolgg/discord';
import { Time } from '@oldschoolgg/toolkit';
import { Bank, toKMB } from 'oldschooljs';

import {
	additionalBetRequiredForAction,
	applyInsuranceDecision,
	applyPlayerAction,
	autoStand,
	availableActions,
	type BlackjackAction,
	type BlackjackCard,
	type BlackjackGame,
	calculateInsuranceBet,
	createBlackjackGame,
	handValue,
	settleBlackjackGame
} from '@/lib/blackjack/engine.js';
import {
	createActiveBlackjackGame,
	destroyActiveBlackjackGame,
	getActiveBlackjackGame,
	getActiveBlackjackGameByNonce,
	hasActiveBlackjackGame,
	refreshBlackjackTimeout,
	touchActiveBlackjackGame,
	updateBlackjackMessageID
} from '@/lib/blackjack/state.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const BLACKJACK_MIN_BET = 1_000_000;
const BLACKJACK_MAX_BET = 500_000_000;
const BLACKJACK_DECISION_TIMEOUT = Time.Second * 45;

type InsuranceAction = 'INSURE' | 'NO_INSURE';
type BlackjackButtonAction = BlackjackAction | InsuranceAction;

function makeBlackjackButtonID(action: BlackjackButtonAction, nonce: string): string {
	return `BJ|${action}|${nonce}`;
}

function parseBlackjackButtonID(id: string): { action: BlackjackButtonAction; nonce: string } | null {
	const [prefix, action, nonce] = id.split('|');
	if (prefix !== 'BJ' || !action || !nonce) return null;
	if (!['HIT', 'STAND', 'DOUBLE', 'SPLIT', 'INSURE', 'NO_INSURE'].includes(action)) return null;
	return { action: action as BlackjackButtonAction, nonce };
}

function suitShort(card: BlackjackCard): string {
	if (card.suit === 'clubs') return 'C';
	if (card.suit === 'diamonds') return 'D';
	if (card.suit === 'hearts') return 'H';
	return 'S';
}

function cardString(card: BlackjackCard): string {
	return `${card.rank}${suitShort(card)}`;
}

function cardsString(cards: BlackjackCard[], hideSecondCard = false): string {
	if (!hideSecondCard) return cards.map(cardString).join(' ');
	return cards.map((card, index) => (index === 1 ? '??' : cardString(card))).join(' ');
}

function outcomeLabel(outcome: 'blackjack' | 'win' | 'lose' | 'push'): string {
	if (outcome === 'blackjack') return 'Blackjack';
	if (outcome === 'win') return 'Win';
	if (outcome === 'lose') return 'Lose';
	return 'Push';
}

function gameEmbed({ game, timedOut = false }: { game: BlackjackGame; timedOut?: boolean }): EmbedBuilder {
	const embed = new EmbedBuilder().setTitle('Blackjack').setColor(0x1f8b4c);
	const hideDealerHole = game.phase === 'insurance' || game.phase === 'player';
	const dealerVisibleCards = hideDealerHole ? [game.dealerCards[0]] : game.dealerCards;
	const dealerValue = handValue(dealerVisibleCards).total;
	embed.addFields({
		name: 'Dealer',
		value: `${cardsString(game.dealerCards, hideDealerHole)} (${hideDealerHole ? dealerValue : handValue(game.dealerCards).total})`
	});

	for (let index = 0; index < game.hands.length; index++) {
		const hand = game.hands[index];
		const value = handValue(hand.cards);
		const isCurrent = game.phase === 'player' && game.currentHandIndex === index;
		const flags: string[] = [];
		if (isCurrent) flags.push('Current');
		if (hand.isSplitAces) flags.push('Split aces');
		if (hand.doubled) flags.push('Doubled');
		if (value.isBust) flags.push('Bust');
		if (hand.stood && !value.isBust) flags.push('Stand');
		const flagText = flags.length > 0 ? ` [${flags.join(', ')}]` : '';
		embed.addFields({
			name: `Hand ${index + 1}${flagText}`,
			value: `${cardsString(hand.cards)} (${value.total}) - Bet: ${toKMB(hand.bet)}`
		});
	}

	if (game.phase === 'insurance') {
		embed.setDescription(`Dealer shows an Ace. Insurance is available.\nMain bet: ${toKMB(game.baseBet)}.`);
	} else if (game.phase === 'player') {
		embed.setDescription(`Choose an action. Auto-stand in ${Math.floor(BLACKJACK_DECISION_TIMEOUT / 1000)}s.`);
	} else if (game.phase === 'dealer') {
		embed.setDescription('Dealer is playing out the hand.');
	} else if (timedOut) {
		embed.setDescription('Timed out. The hand was auto-stood and settled safely.');
	}

	return embed;
}

function finishedEmbed({ game, timedOut = false }: { game: BlackjackGame; timedOut?: boolean }): EmbedBuilder {
	const settlement = settleBlackjackGame(game);
	const lines: string[] = [];
	for (const hand of settlement.hands) {
		lines.push(
			`Hand ${hand.index + 1}: ${outcomeLabel(hand.outcome)} (${hand.playerValue.total}) ${toKMB(hand.payout)}`
		);
	}
	if (settlement.insuranceBet > 0) {
		lines.push(
			`Insurance: ${settlement.insurancePayout > 0 ? 'Win' : 'Lose'} (${toKMB(settlement.insurancePayout)})`
		);
	}
	lines.push(`Net: ${settlement.net >= 0 ? '+' : ''}${toKMB(settlement.net)}`);

	return new EmbedBuilder()
		.setTitle('Blackjack Result')
		.setColor(settlement.net >= 0 ? 0x57f287 : 0xed4245)
		.setDescription(`${timedOut ? 'Timed out, auto-stand applied.\n' : ''}${lines.join('\n')}`)
		.addFields({
			name: 'Dealer',
			value: `${cardsString(game.dealerCards)} (${settlement.dealerValue.total})`
		});
}

function activeComponents(game: BlackjackGame, nonce: string): ButtonBuilder[][] {
	if (game.phase === 'insurance') {
		return [
			[
				new ButtonBuilder()
					.setCustomId(makeBlackjackButtonID('INSURE', nonce))
					.setLabel('Take insurance')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(makeBlackjackButtonID('NO_INSURE', nonce))
					.setLabel('Skip insurance')
					.setStyle(ButtonStyle.Secondary)
			]
		];
	}
	if (game.phase !== 'player') return [];
	const actions = availableActions(game);
	const row: ButtonBuilder[] = [];
	if (actions.hit) {
		row.push(
			new ButtonBuilder()
				.setCustomId(makeBlackjackButtonID('HIT', nonce))
				.setLabel('Hit')
				.setStyle(ButtonStyle.Primary)
		);
	}
	if (actions.stand) {
		row.push(
			new ButtonBuilder()
				.setCustomId(makeBlackjackButtonID('STAND', nonce))
				.setLabel('Stand')
				.setStyle(ButtonStyle.Secondary)
		);
	}
	if (actions.double) {
		row.push(
			new ButtonBuilder()
				.setCustomId(makeBlackjackButtonID('DOUBLE', nonce))
				.setLabel('Double')
				.setStyle(ButtonStyle.Success)
		);
	}
	if (actions.split) {
		row.push(
			new ButtonBuilder()
				.setCustomId(makeBlackjackButtonID('SPLIT', nonce))
				.setLabel('Split')
				.setStyle(ButtonStyle.Secondary)
		);
	}
	return row.length > 0 ? [row] : [];
}

function gameIsFinished(game: BlackjackGame): boolean {
	return game.phase === 'finished';
}

async function applySettlementToUser(user: MUser, game: BlackjackGame): Promise<void> {
	const settlement = settleBlackjackGame(game);
	if (settlement.totalPayout > 0) {
		await user.transactItems({
			itemsToAdd: new Bank().add('Coins', settlement.totalPayout),
			collectionLog: false
		});
	}
}

async function onBlackjackTimeout(userID: string, nonce: string): Promise<void> {
	const active = getActiveBlackjackGame(userID);
	if (!active || active.nonce !== nonce) return;

	const user = await mUserFetch(userID);
	await user.withLock('blackjack_timeout', async lockedUser => {
		const current = getActiveBlackjackGame(userID);
		if (!current || current.nonce !== nonce) return;
		autoStand(current.game);
		await applySettlementToUser(lockedUser, current.game);
		const finalEmbed = finishedEmbed({ game: current.game, timedOut: true });
		destroyActiveBlackjackGame(userID);
		try {
			if (current.messageID) {
				await globalClient.editMessage(current.channelID, current.messageID, {
					embeds: [finalEmbed],
					components: []
				});
				return;
			}
			await globalClient.sendMessage(current.channelID, {
				content: `<@${userID}>`,
				embeds: [finalEmbed]
			});
		} catch {
			await globalClient.sendMessage(current.channelID, {
				content: `<@${userID}>`,
				embeds: [finalEmbed]
			});
		}
	});
}

function scheduleBlackjackTimeout(userID: string): void {
	refreshBlackjackTimeout({
		userID,
		timeoutMs: BLACKJACK_DECISION_TIMEOUT,
		onTimeout: game => onBlackjackTimeout(game.userID, game.nonce)
	});
}

export async function blackjackCommand({
	rng,
	user,
	interaction,
	channelID,
	amountInput
}: {
	rng: RNGProvider;
	user: MUser;
	interaction: MInteraction;
	channelID: string;
	amountInput: string | undefined;
}): Promise<CommandResponse> {
	const amount = mahojiParseNumber({ input: amountInput, min: 1 });
	if (!amount) {
		return `Play blackjack with standard casino rules.
- Bet range: ${toKMB(BLACKJACK_MIN_BET)} to ${toKMB(BLACKJACK_MAX_BET)}
- 4 deck shoe, dealer stands on soft 17, blackjack pays 3:2.
- Supports insurance, double and split (including split aces).

Use: ${globalClient.mentionCommand('gamble', 'blackjack')} amount:100m`;
	}
	if (amount < BLACKJACK_MIN_BET || amount > BLACKJACK_MAX_BET) {
		return `You must bet between ${toKMB(BLACKJACK_MIN_BET)} and ${toKMB(BLACKJACK_MAX_BET)}.`;
	}
	if (hasActiveBlackjackGame(user.id)) {
		return 'You already have an active blackjack game.';
	}

	await interaction.confirmation(`Are you sure you want to play blackjack for ${toKMB(amount)}?`);

	const result = await user.withLock('blackjack_start', async lockedUser => {
		if (hasActiveBlackjackGame(lockedUser.id)) {
			return { error: 'You already have an active blackjack game.' } as const;
		}
		try {
			await lockedUser.transactItems({
				itemsToRemove: new Bank().add('Coins', amount)
			});
		} catch {
			return { error: "You don't have enough GP to make this bet." } as const;
		}

		const game = createBlackjackGame({ bet: amount, rng });
		if (game.phase === 'finished') {
			await applySettlementToUser(lockedUser, game);
			return {
				finished: true,
				embed: finishedEmbed({ game })
			} as const;
		}

		const active = createActiveBlackjackGame({
			userID: lockedUser.id,
			channelID,
			game
		});
		return {
			finished: false,
			embed: gameEmbed({ game }),
			components: activeComponents(game, active.nonce),
			nonce: active.nonce
		} as const;
	});

	if ('error' in result) {
		return result.error ?? 'Failed to start blackjack game.';
	}
	if (result.finished) {
		return { embeds: [result.embed], components: [] };
	}

	scheduleBlackjackTimeout(user.id);
	const sent = await interaction.replyWithResponse({
		embeds: [result.embed],
		components: result.components
	});
	if (sent?.message_id) {
		updateBlackjackMessageID(user.id, sent.message_id);
	}
	return SpecialResponse.RespondedManually;
}

export async function blackjackButtonHandler({
	customID,
	interaction
}: {
	customID: string;
	interaction: OSInteraction;
}): Promise<CommandResponse> {
	const parsed = parseBlackjackButtonID(customID);
	if (!parsed) {
		return { content: 'Invalid blackjack interaction.', ephemeral: true };
	}
	const active = getActiveBlackjackGameByNonce(parsed.nonce);
	if (!active) {
		return { content: 'This blackjack game is no longer active.', ephemeral: true };
	}
	if (interaction.userId !== active.userID) {
		return { content: "This isn't your blackjack game.", ephemeral: true };
	}

	const user = await mUserFetch(active.userID);
	await user.withLock('blackjack_button', async lockedUser => {
		const current = getActiveBlackjackGameByNonce(parsed.nonce);
		if (!current || current.userID !== interaction.userId) {
			await interaction.reply({ content: 'This blackjack game is no longer active.', ephemeral: true });
			return;
		}
		let deductedBet = 0;
		try {
			if (parsed.action === 'INSURE' || parsed.action === 'NO_INSURE') {
				if (current.game.phase !== 'insurance') {
					await interaction.reply({ content: 'Insurance is not available now.', ephemeral: true });
					return;
				}
				if (parsed.action === 'INSURE') {
					const insuranceBet = calculateInsuranceBet(current.game.baseBet);
					if (insuranceBet > 0) {
						try {
							await lockedUser.transactItems({
								itemsToRemove: new Bank().add('Coins', insuranceBet)
							});
							deductedBet = insuranceBet;
						} catch {
							await interaction.reply({ content: "You can't afford insurance.", ephemeral: true });
							return;
						}
					}
					applyInsuranceDecision(current.game, true);
				} else {
					applyInsuranceDecision(current.game, false);
				}
			} else {
				if (current.game.phase !== 'player') {
					await interaction.reply({ content: 'You cannot act right now.', ephemeral: true });
					return;
				}
				const extraBet = additionalBetRequiredForAction(current.game, parsed.action);
				if (extraBet > 0) {
					try {
						await lockedUser.transactItems({
							itemsToRemove: new Bank().add('Coins', extraBet)
						});
						deductedBet = extraBet;
					} catch {
						await interaction.reply({
							content: `You need ${toKMB(extraBet)} more GP for that action.`,
							ephemeral: true
						});
						return;
					}
				}
				applyPlayerAction(current.game, parsed.action);
			}
		} catch (err) {
			if (deductedBet > 0) {
				await lockedUser.transactItems({
					itemsToAdd: new Bank().add('Coins', deductedBet),
					collectionLog: false
				});
			}
			await interaction.reply({ content: (err as Error).message, ephemeral: true });
			return;
		}

		touchActiveBlackjackGame(current.userID);
		if (gameIsFinished(current.game)) {
			await applySettlementToUser(lockedUser, current.game);
			const embed = finishedEmbed({ game: current.game });
			destroyActiveBlackjackGame(current.userID);
			await interaction.update({
				embeds: [embed],
				components: []
			});
			return;
		}

		scheduleBlackjackTimeout(current.userID);
		await interaction.update({
			embeds: [gameEmbed({ game: current.game })],
			components: activeComponents(current.game, current.nonce)
		});
	});

	return SpecialResponse.RespondedManually;
}
