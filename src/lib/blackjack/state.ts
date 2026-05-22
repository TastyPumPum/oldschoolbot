import { randomBytes } from 'node:crypto';
import { Time } from '@oldschoolgg/toolkit';

import type { BlackjackGame } from '@/lib/blackjack/engine.js';

export interface ActiveBlackjackGame {
	userID: string;
	channelID: string;
	messageID: string | null;
	nonce: string;
	game: BlackjackGame;
	createdAt: number;
	updatedAt: number;
	timeout: NodeJS.Timeout | null;
}

export interface PendingBlackjackStart {
	userID: string;
	channelID: string;
	messageID: string | null;
	nonce: string;
	amount: number;
	createdAt: number;
	updatedAt: number;
	timeout: NodeJS.Timeout | null;
}

const gamesByUser = new Map<string, ActiveBlackjackGame>();
const userByNonce = new Map<string, string>();
const pendingStartsByUser = new Map<string, PendingBlackjackStart>();
const pendingStartUserByNonce = new Map<string, string>();
const ACTIVE_GAME_TTL_SECONDS = Math.floor(Time.Hour / Time.Second);
const PENDING_START_TTL_SECONDS = Math.floor((Time.Minute * 5) / Time.Second);

type StoredActiveBlackjackGame = Omit<ActiveBlackjackGame, 'timeout'>;
type StoredPendingBlackjackStart = Omit<PendingBlackjackStart, 'timeout'>;

function activeUserKey(userID: string): string {
	return `blackjack:active:user:${userID}`;
}

function activeNonceKey(nonce: string): string {
	return `blackjack:active:nonce:${nonce}`;
}

function pendingUserKey(userID: string): string {
	return `blackjack:pending:user:${userID}`;
}

function pendingNonceKey(nonce: string): string {
	return `blackjack:pending:nonce:${nonce}`;
}

function generateNonce(): string {
	return randomBytes(10).toString('hex');
}

function removeNonce(nonce: string): void {
	userByNonce.delete(nonce);
}

function removePendingStartNonce(nonce: string): void {
	pendingStartUserByNonce.delete(nonce);
}

function serialiseActive(game: ActiveBlackjackGame): StoredActiveBlackjackGame {
	const { timeout: _timeout, ...stored } = game;
	return stored;
}

function serialisePending(pending: PendingBlackjackStart): StoredPendingBlackjackStart {
	const { timeout: _timeout, ...stored } = pending;
	return stored;
}

function hydrateActive(stored: StoredActiveBlackjackGame): ActiveBlackjackGame {
	return { ...stored, timeout: null };
}

function hydratePending(stored: StoredPendingBlackjackStart): PendingBlackjackStart {
	return { ...stored, timeout: null };
}

async function persistActiveBlackjackGame(game: ActiveBlackjackGame): Promise<void> {
	await Promise.all([
		Cache.setTemporaryJson(activeUserKey(game.userID), serialiseActive(game), ACTIVE_GAME_TTL_SECONDS),
		Cache.setTemporaryJson(activeNonceKey(game.nonce), { userID: game.userID }, ACTIVE_GAME_TTL_SECONDS)
	]);
}

async function persistPendingBlackjackStart(pending: PendingBlackjackStart): Promise<void> {
	await Promise.all([
		Cache.setTemporaryJson(pendingUserKey(pending.userID), serialisePending(pending), PENDING_START_TTL_SECONDS),
		Cache.setTemporaryJson(pendingNonceKey(pending.nonce), { userID: pending.userID }, PENDING_START_TTL_SECONDS)
	]);
}

export async function hasActiveBlackjackGame(userID: string): Promise<boolean> {
	return (await getActiveBlackjackGame(userID)) !== null;
}

export async function hasPendingBlackjackStart(userID: string): Promise<boolean> {
	return (await getPendingBlackjackStart(userID)) !== null;
}

export async function getActiveBlackjackGame(userID: string): Promise<ActiveBlackjackGame | null> {
	const local = gamesByUser.get(userID);
	if (local) return local;
	const stored = await Cache.getTemporaryJson<StoredActiveBlackjackGame>(activeUserKey(userID));
	if (!stored) return null;
	const active = hydrateActive(stored);
	gamesByUser.set(userID, active);
	userByNonce.set(active.nonce, userID);
	return active;
}

export async function getPendingBlackjackStart(userID: string): Promise<PendingBlackjackStart | null> {
	const local = pendingStartsByUser.get(userID);
	if (local) return local;
	const stored = await Cache.getTemporaryJson<StoredPendingBlackjackStart>(pendingUserKey(userID));
	if (!stored) return null;
	const pending = hydratePending(stored);
	pendingStartsByUser.set(userID, pending);
	pendingStartUserByNonce.set(pending.nonce, userID);
	return pending;
}

export async function getActiveBlackjackGameByNonce(nonce: string): Promise<ActiveBlackjackGame | null> {
	let userID = userByNonce.get(nonce);
	if (!userID) {
		const stored = await Cache.getTemporaryJson<{ userID: string }>(activeNonceKey(nonce));
		userID = stored?.userID;
	}
	if (!userID) return null;
	return getActiveBlackjackGame(userID);
}

export async function getPendingBlackjackStartByNonce(nonce: string): Promise<PendingBlackjackStart | null> {
	let userID = pendingStartUserByNonce.get(nonce);
	if (!userID) {
		const stored = await Cache.getTemporaryJson<{ userID: string }>(pendingNonceKey(nonce));
		userID = stored?.userID;
	}
	if (!userID) return null;
	return getPendingBlackjackStart(userID);
}

export async function createActiveBlackjackGame({
	userID,
	channelID,
	game
}: {
	userID: string;
	channelID: string;
	game: BlackjackGame;
}): Promise<ActiveBlackjackGame> {
	if (gamesByUser.has(userID)) {
		throw new Error('User already has an active blackjack game.');
	}
	const now = Date.now();
	const nonce = generateNonce();
	const active: ActiveBlackjackGame = {
		userID,
		channelID,
		messageID: null,
		nonce,
		game,
		createdAt: now,
		updatedAt: now,
		timeout: null
	};
	gamesByUser.set(userID, active);
	userByNonce.set(nonce, userID);
	await persistActiveBlackjackGame(active);
	return active;
}

export async function createPendingBlackjackStart({
	userID,
	channelID,
	amount
}: {
	userID: string;
	channelID: string;
	amount: number;
}): Promise<PendingBlackjackStart> {
	if (pendingStartsByUser.has(userID)) {
		throw new Error('User already has a pending blackjack start.');
	}
	const now = Date.now();
	const nonce = generateNonce();
	const pending: PendingBlackjackStart = {
		userID,
		channelID,
		messageID: null,
		nonce,
		amount,
		createdAt: now,
		updatedAt: now,
		timeout: null
	};
	pendingStartsByUser.set(userID, pending);
	pendingStartUserByNonce.set(nonce, userID);
	await persistPendingBlackjackStart(pending);
	return pending;
}

export async function updateBlackjackMessageID(userID: string, messageID: string): Promise<void> {
	const game = gamesByUser.get(userID);
	if (!game) return;
	game.messageID = messageID;
	game.updatedAt = Date.now();
	await persistActiveBlackjackGame(game);
}

export async function updatePendingBlackjackStartMessageID(userID: string, messageID: string): Promise<void> {
	const pending = pendingStartsByUser.get(userID);
	if (!pending) return;
	pending.messageID = messageID;
	pending.updatedAt = Date.now();
	await persistPendingBlackjackStart(pending);
}

export function refreshBlackjackTimeout({
	userID,
	timeoutMs,
	onTimeout
}: {
	userID: string;
	timeoutMs: number;
	onTimeout: (game: ActiveBlackjackGame) => Promise<void> | void;
}): void {
	const game = gamesByUser.get(userID);
	if (!game) return;
	if (game.timeout) {
		clearTimeout(game.timeout);
	}
	const expectedNonce = game.nonce;
	game.timeout = setTimeout(async () => {
		const current = gamesByUser.get(userID);
		if (!current) return;
		if (current.nonce !== expectedNonce) return;
		try {
			await onTimeout(current);
		} catch (err) {
			Logging.logError(err as Error);
		}
	}, timeoutMs);
}

export function refreshPendingBlackjackStartTimeout({
	userID,
	timeoutMs,
	onTimeout
}: {
	userID: string;
	timeoutMs: number;
	onTimeout: (pending: PendingBlackjackStart) => Promise<void> | void;
}): void {
	const pending = pendingStartsByUser.get(userID);
	if (!pending) return;
	if (pending.timeout) {
		clearTimeout(pending.timeout);
	}
	const expectedNonce = pending.nonce;
	pending.timeout = setTimeout(async () => {
		const current = pendingStartsByUser.get(userID);
		if (!current) return;
		if (current.nonce !== expectedNonce) return;
		try {
			await onTimeout(current);
		} catch (err) {
			Logging.logError(err as Error);
		}
	}, timeoutMs);
}

export function clearBlackjackTimeout(userID: string): void {
	const game = gamesByUser.get(userID);
	if (!game) return;
	if (game.timeout) {
		clearTimeout(game.timeout);
		game.timeout = null;
	}
}

export function clearPendingBlackjackStartTimeout(userID: string): void {
	const pending = pendingStartsByUser.get(userID);
	if (!pending) return;
	if (pending.timeout) {
		clearTimeout(pending.timeout);
		pending.timeout = null;
	}
}

export async function destroyActiveBlackjackGame(userID: string): Promise<void> {
	const game = gamesByUser.get(userID) ?? (await getActiveBlackjackGame(userID));
	if (!game) return;
	if (game.timeout) {
		clearTimeout(game.timeout);
	}
	removeNonce(game.nonce);
	gamesByUser.delete(userID);
	await Cache.deleteKeys(activeUserKey(userID), activeNonceKey(game.nonce));
}

export async function destroyPendingBlackjackStart(userID: string): Promise<void> {
	const pending = pendingStartsByUser.get(userID) ?? (await getPendingBlackjackStart(userID));
	if (!pending) return;
	if (pending.timeout) {
		clearTimeout(pending.timeout);
	}
	removePendingStartNonce(pending.nonce);
	pendingStartsByUser.delete(userID);
	await Cache.deleteKeys(pendingUserKey(userID), pendingNonceKey(pending.nonce));
}

export async function touchActiveBlackjackGame(userID: string): Promise<void> {
	const game = gamesByUser.get(userID);
	if (!game) return;
	game.updatedAt = Date.now();
	await persistActiveBlackjackGame(game);
}

export async function touchPendingBlackjackStart(userID: string): Promise<void> {
	const pending = pendingStartsByUser.get(userID);
	if (!pending) return;
	pending.updatedAt = Date.now();
	await persistPendingBlackjackStart(pending);
}
