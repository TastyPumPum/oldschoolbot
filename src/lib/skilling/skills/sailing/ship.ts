import type { UserShip } from '@/prisma/main.js';
import type { BarracudaTrialsProgress } from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';
import type { StoredSalvage } from '@/lib/skilling/skills/sailing/salvaging.js';
import {
	getDefaultShipParts,
	normaliseShipParts,
	type SailingShipParts,
	type SailingShipType
} from '@/lib/skilling/skills/sailing/shipParts.js';

export type SailingShipSnapshot = {
	shipType: SailingShipType;
	facilities: SailingFacilityId[];
	parts: SailingShipParts;
};

export type SailingConfiguredShip = {
	facilities?: SailingFacilityId[];
	parts?: SailingShipParts;
	salvage?: StoredSalvage;
};

export type SailingUpgradesBank = {
	activeShipType?: SailingShipType;
	ships?: Partial<Record<SailingShipType, SailingConfiguredShip>>;
	clamItemId?: number | null;
	clamFedAt?: number | null;
	completedChartingTaskIds?: number[];
	claimedChartingCompletionBonuses?: string[];
	barracudaTrials?: BarracudaTrialsProgress;
};

export function getUpgradesBank(ship: UserShip): SailingUpgradesBank {
	const raw = ship.upgrades_bank as SailingUpgradesBank | null;
	return raw ?? {};
}

export function getActiveShipType(ship: UserShip): SailingShipType {
	return getUpgradesBank(ship).activeShipType ?? 'raft';
}

export function getConfiguredShip(
	ship: UserShip,
	shipType: SailingShipType = getActiveShipType(ship)
): SailingConfiguredShip {
	return getUpgradesBank(ship).ships?.[shipType] ?? {};
}

export function getInstalledFacilities(
	ship: UserShip,
	shipType: SailingShipType = getActiveShipType(ship)
): SailingFacilityId[] {
	return getConfiguredShip(ship, shipType).facilities ?? [];
}

export function getShipParts(ship: UserShip, shipType: SailingShipType = getActiveShipType(ship)): SailingShipParts {
	return normaliseShipParts(getConfiguredShip(ship, shipType).parts, shipType);
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

export function getStoredSalvage(ship: UserShip, shipType: SailingShipType = getActiveShipType(ship)): StoredSalvage {
	return getConfiguredShip(ship, shipType).salvage ?? {};
}

export function getBarracudaTrialsProgress(ship: UserShip): BarracudaTrialsProgress {
	return getUpgradesBank(ship).barracudaTrials ?? {};
}

export function getShips(upgrades: SailingUpgradesBank): Partial<Record<SailingShipType, SailingConfiguredShip>> {
	return upgrades.ships ?? {};
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

export async function updateConfiguredShip(
	userID: string,
	shipType: SailingShipType,
	updates: Partial<SailingConfiguredShip>
) {
	const ship = await getOrCreateUserShip(userID);
	const current = getUpgradesBank(ship);
	const currentShips = getShips(current);
	const currentShip = currentShips[shipType] ?? {
		parts: getDefaultShipParts(shipType)
	};
	return prisma.userShip.update({
		where: { user_id: userID },
		data: {
			upgrades_bank: {
				...current,
				ships: {
					...currentShips,
					[shipType]: {
						...currentShip,
						...updates
					}
				}
			}
		}
	});
}

export function snapshotShip(ship: UserShip): SailingShipSnapshot {
	const shipType = getActiveShipType(ship);
	return {
		shipType,
		facilities: getInstalledFacilities(ship, shipType),
		parts: getShipParts(ship, shipType)
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
