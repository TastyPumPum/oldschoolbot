import { Time } from '@oldschoolgg/toolkit';

import type { BlackjackState } from '@/lib/blackjack/engine.js';

export const BLACKJACK_TIMEOUT_MS = Time.Second * 75;

export interface BlackjackGame extends BlackjackState {
	userId: string;
	channelId: string | null;
	messageId: string | null;
	nonce: string;
	createdAt: number;
	timeoutAt?: number;
}

export const activeBlackjackGames = new Map<string, BlackjackGame>();
export const blackjackTimeouts = new Map<string, NodeJS.Timeout>();

export function clearBlackjackGame(userId: string): void {
	const timeout = blackjackTimeouts.get(userId);
	if (timeout) {
		clearTimeout(timeout);
		blackjackTimeouts.delete(userId);
	}
	activeBlackjackGames.delete(userId);
}
