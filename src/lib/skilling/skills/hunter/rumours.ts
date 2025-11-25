import { randArrItem, uniqueArr } from '@oldschoolgg/toolkit';

import type { Creature } from '@/lib/skilling/types.js';
import Hunter from './hunter.js';

export type RumourTier = 'Novice' | 'Adept' | 'Expert' | 'Master';

export interface HunterRumourAssignment {
	tier: RumourTier;
	creatureID: number;
	progress: number;
	completed?: boolean;
	completedAt?: number;
}

export interface HunterRumourState {
	backToBack: boolean;
	blockedCreatureIds: number[];
	assignments: Partial<Record<RumourTier, HunterRumourAssignment>>;
}

export const hunterRumourTierInfo: Record<
	RumourTier,
	{ levelRequirement: number; modifier: number; maxLevel?: number }
> = {
	Novice: { levelRequirement: 46, modifier: 50, maxLevel: 56 },
	Adept: { levelRequirement: 57, modifier: 50, maxLevel: 71 },
	Expert: { levelRequirement: 72, modifier: 55, maxLevel: 90 },
	Master: { levelRequirement: 91, modifier: 60 }
};

export function defaultHunterRumourState(): HunterRumourState {
	return {
		backToBack: false,
		blockedCreatureIds: [],
		assignments: {}
	};
}

export function isRumourTierUnlocked(tier: RumourTier, hunterLevel: number) {
	return hunterLevel >= hunterRumourTierInfo[tier].levelRequirement;
}

function blockedCreatureSet(state: HunterRumourState, excludeTier?: RumourTier) {
	const activeAssignments = Object.values(state.assignments)
		.filter(Boolean)
		.filter(a => (excludeTier ? a?.tier !== excludeTier : true))
		.map(a => a!.creatureID);

	return new Set([...state.blockedCreatureIds, ...activeAssignments]);
}

export function pickRumourCreature(tier: RumourTier, hunterLevel: number, state: HunterRumourState): Creature | null {
	const tierInfo = hunterRumourTierInfo[tier];
	if (hunterLevel < tierInfo.levelRequirement) return null;

	const blocked = blockedCreatureSet(state, tier);
	const candidates = Hunter.Creatures.filter(creature => {
		if (blocked.has(creature.id)) return false;
		if (tierInfo.maxLevel && creature.level > tierInfo.maxLevel) return false;
		return true;
	});

	if (candidates.length === 0) return null;

	return randArrItem(candidates);
}

export function assignRumour(tier: RumourTier, creatureID: number, state: HunterRumourState): HunterRumourState {
	const blocked = blockedCreatureSet(state, tier);
	const existing = state.assignments[tier];
	const updatedBlocked = uniqueArr(existing ? [...blocked, existing.creatureID] : Array.from(blocked));

	const nextState: HunterRumourState = {
		...state,
		blockedCreatureIds: updatedBlocked,
		assignments: {
			...state.assignments,
			[tier]: {
				tier,
				creatureID,
				progress: 0
			}
		}
	};

	return nextState;
}

export function updateRumourProgress(tier: RumourTier, amount: number, state: HunterRumourState): HunterRumourState {
	const current = state.assignments[tier];
	if (!current) return state;

	return {
		...state,
		assignments: {
			...state.assignments,
			[tier]: {
				...current,
				progress: current.progress + amount
			}
		}
	};
}

export function completeRumour(
	tier: RumourTier,
	state: HunterRumourState,
	opts?: { completedAt?: number }
): HunterRumourState {
	const current = state.assignments[tier];
	if (!current) return state;

	return {
		...state,
		assignments: {
			...state.assignments,
			[tier]: {
				...current,
				completed: true,
				completedAt: opts?.completedAt ?? Date.now()
			}
		}
	};
}

export function clearRumour(tier: RumourTier, state: HunterRumourState) {
	const assignments = { ...state.assignments };
	delete assignments[tier];
	return {
		...state,
		assignments
	} satisfies HunterRumourState;
}
