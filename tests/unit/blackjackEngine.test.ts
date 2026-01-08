import { describe, expect, it } from 'vitest';

import {
	applySplit,
	type BlackjackHand,
	type BlackjackState,
	type Card,
	canSplitHand,
	createInitialState,
	dealerShouldDraw,
	handValue,
	settleGame
} from '@/lib/blackjack/engine.js';

const card = (rank: Card['rank'], suit: Card['suit'] = '♠'): Card => ({ rank, suit });

function buildState(overrides: Partial<BlackjackState>): BlackjackState {
	return {
		phase: 'PLAYER_TURN',
		mainBet: 100,
		insuranceBet: 0,
		deck: [],
		drawIndex: 0,
		dealerHand: [],
		dealerHasBlackjack: false,
		playerHands: [],
		currentHandIndex: 0,
		...overrides
	};
}

function buildHand(overrides: Partial<BlackjackHand>): BlackjackHand {
	return {
		cards: [],
		bet: 100,
		isSplitAcesHand: false,
		doubled: false,
		isComplete: false,
		canBeBlackjack: true,
		...overrides
	};
}

describe('blackjack handValue', () => {
	it('handles multiple aces and soft totals', () => {
		const value = handValue([card('A'), card('A', '♥'), card('9', '♦')], { canBeBlackjack: true });
		expect(value.total).toBe(21);
		expect(value.isSoft).toBe(true);

		const hardValue = handValue([card('A'), card('A', '♥'), card('9', '♦'), card('9', '♣')], {
			canBeBlackjack: true
		});
		expect(hardValue.total).toBe(20);
		expect(hardValue.isSoft).toBe(false);
	});

	it('only treats initial two-card 21 as blackjack', () => {
		const blackjack = handValue([card('A'), card('K')], { canBeBlackjack: true });
		expect(blackjack.isBlackjack).toBe(true);

		const splitAce21 = handValue([card('A'), card('K')], { canBeBlackjack: false });
		expect(splitAce21.isBlackjack).toBe(false);
	});
});

describe('dealer S17 rules', () => {
	it('stands on soft 17 and hits soft 16', () => {
		const soft17 = handValue([card('A'), card('6')], { canBeBlackjack: true });
		const soft16 = handValue([card('A'), card('5')], { canBeBlackjack: true });
		expect(dealerShouldDraw(soft17)).toBe(false);
		expect(dealerShouldDraw(soft16)).toBe(true);
	});
});

describe('split aces and split flow', () => {
	it('split aces draw one card each and auto-complete', () => {
		const state = createInitialState({
			mainBet: 100,
			deck: [card('K'), card('9')]
		});
		state.playerHands = [buildHand({ cards: [card('A'), card('A', '♥')] })];
		state.currentHandIndex = 0;

		applySplit(state);
		expect(state.playerHands).toHaveLength(2);
		expect(state.playerHands[0].isSplitAcesHand).toBe(true);
		expect(state.playerHands[1].isSplitAcesHand).toBe(true);
		expect(state.playerHands[0].cards).toHaveLength(2);
		expect(state.playerHands[1].cards).toHaveLength(2);
		expect(state.playerHands[0].isComplete).toBe(true);
		expect(state.playerHands[1].isComplete).toBe(true);
	});

	it('enforces max two hands and preserves split bets', () => {
		const state = createInitialState({
			mainBet: 100,
			deck: [card('2'), card('3')]
		});
		state.playerHands = [buildHand({ cards: [card('8'), card('8', '♥')] })];
		applySplit(state);
		expect(state.playerHands).toHaveLength(2);
		expect(canSplitHand(state)).toBe(false);
		expect(state.playerHands[0].bet).toBe(100);
		expect(state.playerHands[1].bet).toBe(100);
	});
});

describe('insurance and settlement', () => {
	it('pays insurance on dealer blackjack and pushes player blackjack', () => {
		const state = buildState({
			mainBet: 100,
			insuranceBet: 50,
			dealerHand: [card('A'), card('K')],
			dealerHasBlackjack: true,
			playerHands: [buildHand({ cards: [card('A', '♥'), card('K', '♦')] })]
		});
		const result = settleGame(state);
		expect(result.totalPayout).toBe(250);
		expect(state.playerHands[0].outcome).toBe('push');
	});

	it('pays insurance on dealer blackjack and main loses otherwise', () => {
		const state = buildState({
			mainBet: 100,
			insuranceBet: 50,
			dealerHand: [card('A'), card('K')],
			dealerHasBlackjack: true,
			playerHands: [buildHand({ cards: [card('9'), card('8')] })]
		});
		const result = settleGame(state);
		expect(result.totalPayout).toBe(150);
		expect(state.playerHands[0].outcome).toBe('lose');
	});

	it('loses insurance when dealer does not have blackjack', () => {
		const state = buildState({
			mainBet: 100,
			insuranceBet: 50,
			dealerHand: [card('A'), card('7')],
			dealerHasBlackjack: false,
			playerHands: [buildHand({ cards: [card('10'), card('Q')] })]
		});
		const result = settleGame(state);
		expect(result.totalPayout).toBe(200);
	});
});
