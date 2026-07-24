import { Monsters } from 'oldschooljs';

import { SlayerTaskUnlocksEnum } from '@/lib/slayer/slayerUnlocks.js';
import type { AssignableSlayerTask } from '@/lib/slayer/types.js';

export const METAL_DRAGON_TASK_IDS = [
	Monsters.BronzeDragon.id,
	Monsters.IronDragon.id,
	Monsters.SteelDragon.id,
	Monsters.MithrilDragon.id,
	Monsters.AdamantDragon.id,
	Monsters.RuneDragon.id
] as const;

export const METAL_DRAGON_CANONICAL_ID = Monsters.BronzeDragon.id;

export function isMetalDragonTaskID(monsterID: number) {
	return METAL_DRAGON_TASK_IDS.some(id => id === monsterID);
}

export function canonicalSlayerTaskMonsterID(monsterID: number) {
	return isMetalDragonTaskID(monsterID) ? METAL_DRAGON_CANONICAL_ID : monsterID;
}

export function metalDragonTask({
	amount,
	extendedAmount,
	weight
}: Pick<AssignableSlayerTask, 'amount' | 'extendedAmount' | 'weight'>): AssignableSlayerTask {
	return {
		monster: Monsters.BronzeDragon,
		amount,
		weight,
		monsters: [...METAL_DRAGON_TASK_IDS],
		extendedAmount,
		extendedUnlockId: SlayerTaskUnlocksEnum.PedalToTheMetals,
		combatLevel: 75,
		questPoints: 34,
		unlocked: true
	};
}
