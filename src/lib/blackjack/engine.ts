import { cryptoRng } from '@oldschoolgg/rng/crypto';

export type Suit = '♠' | '♥' | '♦' | '♣';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export type BlackjackPhase =
	| 'INIT'
	| 'INITIAL_DEAL'
	| 'INSURANCE_OFFER'
	| 'PLAYER_TURN'
	| 'DEALER_TURN'
	| 'SETTLEMENT'
	| 'COMPLETE';

export type HandOutcome = 'blackjack' | 'win' | 'lose' | 'push' | 'bust';

export interface Card {
	rank: Rank;
	suit: Suit;
}

export interface HandValueResult {
	total: number;
	isSoft: boolean;
	isBlackjack: boolean;
}

export interface BlackjackHand {
	cards: Card[];
	bet: number;
	isSplitAcesHand: boolean;
	doubled: boolean;
	isComplete: boolean;
	canBeBlackjack: boolean;
	outcome?: HandOutcome;
}

export interface BlackjackState {
	phase: BlackjackPhase;
	mainBet: number;
	insuranceBet: number;
	deck: Card[];
	drawIndex: number;
	dealerHand: Card[];
	dealerHasBlackjack: boolean;
	playerHands: BlackjackHand[];
	currentHandIndex: number;
}

const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits: Suit[] = ['♠', '♥', '♦', '♣'];

export function createShoe(decks = 4): Card[] {
	const cards: Card[] = [];
	for (let d = 0; d < decks; d++) {
		for (const suit of suits) {
			for (const rank of ranks) {
				cards.push({ rank, suit });
			}
		}
	}
	return cryptoRng.shuffle(cards);
}

export function drawCard(state: BlackjackState): Card {
	const card = state.deck[state.drawIndex];
	if (!card) {
		throw new Error('Blackjack shoe exhausted.');
	}
	state.drawIndex += 1;
	return card;
}

export function isTenValue(rank: Rank): boolean {
	return rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K';
}

export function handValue(cards: Card[], { canBeBlackjack }: { canBeBlackjack: boolean }): HandValueResult {
	let total = 0;
	let aces = 0;
	for (const card of cards) {
		if (card.rank === 'A') {
			aces += 1;
			continue;
		}
		total += isTenValue(card.rank) ? 10 : Number(card.rank);
	}

	total += aces;
	let isSoft = false;
	if (aces > 0 && total + 10 <= 21) {
		total += 10;
		isSoft = true;
	}

	const isBlackjack = canBeBlackjack && cards.length === 2 && total === 21;
	return { total, isSoft, isBlackjack };
}

export function dealerShouldDraw(value: HandValueResult): boolean {
	return value.total < 17;
}

export function createInitialState({ mainBet, deck }: { mainBet: number; deck?: Card[] }): BlackjackState {
	return {
		phase: 'INIT',
		mainBet,
		insuranceBet: 0,
		deck: deck ?? createShoe(),
		drawIndex: 0,
		dealerHand: [],
		dealerHasBlackjack: false,
		playerHands: [],
		currentHandIndex: 0
	};
}

export function startInitialDeal(state: BlackjackState): void {
	state.phase = 'INITIAL_DEAL';
	const playerHand: BlackjackHand = {
		cards: [drawCard(state), drawCard(state)],
		bet: state.mainBet,
		isSplitAcesHand: false,
		doubled: false,
		isComplete: false,
		canBeBlackjack: true
	};
	state.playerHands = [playerHand];
	state.dealerHand = [drawCard(state), drawCard(state)];
	state.currentHandIndex = 0;

	const upcard = state.dealerHand[0];
	if (upcard.rank === 'A' || isTenValue(upcard.rank)) {
		state.dealerHasBlackjack = handValue(state.dealerHand, { canBeBlackjack: true }).isBlackjack;
	}

	if (upcard.rank === 'A') {
		state.phase = 'INSURANCE_OFFER';
		return;
	}

	const playerHasBlackjack = handValue(playerHand.cards, { canBeBlackjack: true }).isBlackjack;
	if (state.dealerHasBlackjack || playerHasBlackjack) {
		state.phase = 'SETTLEMENT';
		return;
	}

	state.phase = 'PLAYER_TURN';
}

export function resolveInsurance(state: BlackjackState, takeInsurance: boolean): void {
	state.insuranceBet = takeInsurance ? Math.floor(state.mainBet / 2) : 0;
	if (state.dealerHasBlackjack) {
		state.phase = 'SETTLEMENT';
		return;
	}
	const playerHasBlackjack = handValue(state.playerHands[0].cards, { canBeBlackjack: true }).isBlackjack;
	if (playerHasBlackjack) {
		state.phase = 'SETTLEMENT';
		return;
	}
	state.phase = 'PLAYER_TURN';
}

export function canSplitHand(state: BlackjackState): boolean {
	if (state.playerHands.length > 1) return false;
	const hand = state.playerHands[state.currentHandIndex];
	if (hand.cards.length !== 2) return false;
	return hand.cards[0].rank === hand.cards[1].rank;
}

export function canDoubleHand(state: BlackjackState): boolean {
	const hand = state.playerHands[state.currentHandIndex];
	if (hand.isSplitAcesHand) return false;
	if (hand.doubled) return false;
	return hand.cards.length === 2;
}

export function applySplit(state: BlackjackState): void {
	if (!canSplitHand(state)) {
		throw new Error('Cannot split this hand.');
	}
	const hand = state.playerHands[state.currentHandIndex];
	const [firstCard, secondCard] = hand.cards;
	const isAces = firstCard.rank === 'A';

	const firstHand: BlackjackHand = {
		cards: [firstCard],
		bet: hand.bet,
		isSplitAcesHand: isAces,
		doubled: false,
		isComplete: false,
		canBeBlackjack: false
	};
	const secondHand: BlackjackHand = {
		cards: [secondCard],
		bet: hand.bet,
		isSplitAcesHand: isAces,
		doubled: false,
		isComplete: false,
		canBeBlackjack: false
	};

	firstHand.cards.push(drawCard(state));
	secondHand.cards.push(drawCard(state));

	if (isAces) {
		firstHand.isComplete = true;
		secondHand.isComplete = true;
	}

	state.playerHands = [firstHand, secondHand];
	state.currentHandIndex = 0;
}

export function applyHit(state: BlackjackState): void {
	const hand = state.playerHands[state.currentHandIndex];
	hand.cards.push(drawCard(state));
	const value = handValue(hand.cards, { canBeBlackjack: hand.canBeBlackjack });
	if (value.total >= 21) {
		hand.isComplete = true;
	}
}

export function applyStand(state: BlackjackState): void {
	const hand = state.playerHands[state.currentHandIndex];
	hand.isComplete = true;
}

export function applyDouble(state: BlackjackState): void {
	const hand = state.playerHands[state.currentHandIndex];
	if (!canDoubleHand(state)) {
		throw new Error('Cannot double this hand.');
	}
	hand.bet *= 2;
	hand.doubled = true;
	hand.cards.push(drawCard(state));
	hand.isComplete = true;
}

export function advanceToNextHand(state: BlackjackState): boolean {
	for (let i = state.currentHandIndex + 1; i < state.playerHands.length; i++) {
		if (!state.playerHands[i].isComplete) {
			state.currentHandIndex = i;
			return true;
		}
	}
	return false;
}

export function resolveDealerTurn(state: BlackjackState): void {
	state.phase = 'DEALER_TURN';
	let value = handValue(state.dealerHand, { canBeBlackjack: true });
	while (dealerShouldDraw(value)) {
		state.dealerHand.push(drawCard(state));
		value = handValue(state.dealerHand, { canBeBlackjack: true });
	}
}

export function settleGame(state: BlackjackState): { totalPayout: number } {
	state.phase = 'SETTLEMENT';
	const dealerValue = handValue(state.dealerHand, { canBeBlackjack: true });
	let totalPayout = 0;

	for (const hand of state.playerHands) {
		const value = handValue(hand.cards, { canBeBlackjack: hand.canBeBlackjack });
		if (value.total > 21) {
			hand.outcome = 'bust';
			continue;
		}

		if (state.dealerHasBlackjack) {
			if (value.isBlackjack) {
				hand.outcome = 'push';
				totalPayout += hand.bet;
			} else {
				hand.outcome = 'lose';
			}
			continue;
		}

		if (value.isBlackjack) {
			hand.outcome = 'blackjack';
			totalPayout += Math.floor((hand.bet * 5) / 2);
			continue;
		}

		if (dealerValue.total > 21) {
			hand.outcome = 'win';
			totalPayout += hand.bet * 2;
			continue;
		}

		if (value.total > dealerValue.total) {
			hand.outcome = 'win';
			totalPayout += hand.bet * 2;
			continue;
		}

		if (value.total === dealerValue.total) {
			hand.outcome = 'push';
			totalPayout += hand.bet;
			continue;
		}

		hand.outcome = 'lose';
	}

	if (state.insuranceBet > 0 && state.dealerHasBlackjack) {
		totalPayout += state.insuranceBet * 3;
	}

	return { totalPayout };
}
