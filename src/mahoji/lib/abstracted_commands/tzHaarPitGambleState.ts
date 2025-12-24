export type PitPhase = 'confirm' | 'playing';

export interface PitTileState {
	kind: 'safe' | 'lava';
	revealed: boolean;
}

export interface TzHaarPitState {
	messageId: string;
	userId: string;

	amount: number;
	phase: PitPhase;

	tiles: PitTileState[];
	createdAt: number;
	expiresAt: number; // refreshed on each valid click
}

const PIT_TTL_MS = 2 * 60_000; // 2 minutes idle expiry

const pitStates = new Map<string, TzHaarPitState>();

export function getPitState(messageId: string) {
	return pitStates.get(messageId);
}

export function setPitState(state: TzHaarPitState) {
	pitStates.set(state.messageId, state);
}

export function deletePitState(messageId: string) {
	pitStates.delete(messageId);
}

export function bumpPitExpiry(state: TzHaarPitState, now = Date.now()) {
	state.expiresAt = now + PIT_TTL_MS;
}

export function isPitExpired(state: TzHaarPitState, now = Date.now()) {
	return now > state.expiresAt;
}
