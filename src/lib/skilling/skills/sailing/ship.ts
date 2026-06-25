import type { UserShip } from '@/prisma/main.js';
import type { BarracudaTrialsProgress } from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';
import type { StoredSalvage } from '@/lib/skilling/skills/sailing/salvaging.js';

export type SailingShipSnapshot = {
	facilities: SailingFacilityId[];
};

export type SailingUpgradesBank = {
	facilities?: SailingFacilityId[];
	clamItemId?: number | null;
	clamFedAt?: number | null;
	completedChartingTaskIds?: number[];
	claimedChartingCompletionBonuses?: string[];
	salvage?: StoredSalvage;
	barracudaTrials?: BarracudaTrialsProgress;
};

export function getUpgradesBank(ship: UserShip): SailingUpgradesBank {
	const raw = ship.upgrades_bank as SailingUpgradesBank | null;
	return raw ?? {};
}

export function getInstalledFacilities(ship: UserShip): SailingFacilityId[] {
	return getUpgradesBank(ship).facilities ?? [];
}

export function getClamItem(ship: UserShip) {
	const upgrades = getUpgradesBank(ship);
	return {
		itemId: upgrades.clamItemId ?? null,
		fedAt: upgrades.clamFedAt ?? null
	};
}

export function hasFacility(ship: UserShip, facility: SailingFacilityId): boolean {
	return getInstalledFacilities(ship).includes(facility);
}

export function getCompletedChartingTaskIds(ship: UserShip): number[] {
	return getUpgradesBank(ship).completedChartingTaskIds ?? [];
}

export function getClaimedChartingCompletionBonuses(ship: UserShip): string[] {
	return getUpgradesBank(ship).claimedChartingCompletionBonuses ?? [];
}

export function getStoredSalvage(ship: UserShip): StoredSalvage {
	return getUpgradesBank(ship).salvage ?? {};
}

export function getBarracudaTrialsProgress(ship: UserShip): BarracudaTrialsProgress {
	return getUpgradesBank(ship).barracudaTrials ?? {};
}

export async function updateUpgradesBank(userID: string, updates: Partial<SailingUpgradesBank>) {
	const ship = await getOrCreateUserShip(userID);
	const current = getUpgradesBank(ship);
	const next = {
		...current,
		...updates
	};
	return prisma.userShip.update({
		where: { user_id: userID },
		data: { upgrades_bank: next }
	});
}

export function snapshotShip(ship: UserShip): SailingShipSnapshot {
	return {
		facilities: getInstalledFacilities(ship)
	};
}

export async function getOrCreateUserShip(userID: string): Promise<UserShip> {
	let ship = await prisma.userShip.findUnique({
		where: { user_id: userID }
	});
	if (!ship) {
		ship = await prisma.userShip.create({
			data: { user_id: userID }
		});
	}
	return ship;
}
