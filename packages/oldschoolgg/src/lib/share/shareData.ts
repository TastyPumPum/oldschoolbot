import { CollectionLog } from '@oldschoolgg/collectionlog';
import { convertXPtoLVL } from 'oldschooljs';

import type { FullMinionData, SUserIdentity } from '../../../../robochimp/src/http/api-types.js';

type UsersMinionsResponse = {
	users: Array<{
		user_id: string;
		minions: Array<{
			is_ironman: boolean;
			has_minion: boolean;
			bot: 'osb' | 'bso';
			total_level: number;
		}>;
	}>;
};

const API_URL = process.env.NODE_ENV === 'production' ? 'https://api.oldschool.gg' : 'https://osgtestapi.magnaboy.com';

const COLLECTION_LOG_ITEMS = new Set<number>();

for (const entry of Object.values(CollectionLog)) {
	if (entry && typeof entry === 'object' && 'items' in entry && Array.isArray(entry.items)) {
		for (const itemId of entry.items) {
			COLLECTION_LOG_ITEMS.add(itemId);
		}
	}
}

const COMBAT_ACHIEVEMENTS_TOTAL = 534;

type ShareProfile = {
	userId: string;
	bot: 'osb' | 'bso';
	minionName: string;
	discordName: string;
	totalXp: number;
	totalLevel: number;
	collectionLogCount: number;
	collectionLogTotal: number;
	combatAchievementsCount: number;
	combatAchievementsTotal: number;
	petItemId: number | null;
};

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return response.json() as Promise<T>;
}

async function resolveBot(userId: string, bot: 'osb' | 'bso' | null): Promise<'osb' | 'bso'> {
	if (bot) return bot;
	const response = await fetchJson<UsersMinionsResponse>(`${API_URL}/user/${userId}/minions`);
	const account = response.users?.[0];
	const minion = account?.minions?.find(entry => entry.has_minion) ?? account?.minions?.[0];
	return minion?.bot ?? 'osb';
}

function resolveCollectionLogCount(minion: FullMinionData): number {
	let count = 0;
	const bankEntries = Object.entries(minion.collection_log_bank ?? {});
	for (const [itemId, qty] of bankEntries) {
		if (!qty) continue;
		if (COLLECTION_LOG_ITEMS.has(Number(itemId))) {
			count += 1;
		}
	}
	return count;
}

function resolveTotalLevel(minion: FullMinionData): number {
	return Object.values(minion.skills_xp ?? {}).reduce((total, xp) => {
		return total + convertXPtoLVL(Math.floor(xp), 99);
	}, 0);
}

export async function fetchShareProfile({
	userId,
	bot
}: {
	userId: string;
	bot: 'osb' | 'bso' | null;
}): Promise<ShareProfile> {
	if (import.meta.env?.DEV) {
		const resolvedBot = bot ?? 'osb';
		return {
			userId,
			bot: resolvedBot,
			minionName: 'Tasty Test Minion',
			discordName: 'TastyTest#0001',
			totalXp: 1_234_567_890,
			totalLevel: 2277,
			collectionLogCount: 500,
			collectionLogTotal: COLLECTION_LOG_ITEMS.size,
			combatAchievementsCount: 150,
			combatAchievementsTotal: COMBAT_ACHIEVEMENTS_TOTAL,
			petItemId: 20659
		};
	}
	const resolvedBot = await resolveBot(userId, bot);
	const [identity, minion] = await Promise.all([
		fetchJson<SUserIdentity>(`${API_URL}/user/identity/${userId}`),
		fetchJson<FullMinionData>(`${API_URL}/user/${userId}/${resolvedBot}/minion`)
	]);

	const totalXp = Object.values(minion.skills_xp ?? {}).reduce((total, xp) => total + xp, 0);
	const totalLevel = resolveTotalLevel(minion);
	const collectionLogCount = resolveCollectionLogCount(minion);

	return {
		userId,
		bot: resolvedBot,
		minionName: minion.name ?? 'Unknown Minion',
		discordName: identity.username ?? 'Unknown',
		totalXp,
		totalLevel,
		collectionLogCount,
		collectionLogTotal: COLLECTION_LOG_ITEMS.size,
		combatAchievementsCount: 0,
		combatAchievementsTotal: COMBAT_ACHIEVEMENTS_TOTAL,
		petItemId: minion.gear?.pet ?? null
	};
}
