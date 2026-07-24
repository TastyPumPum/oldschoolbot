import { writeFileSync } from 'node:fs';
import { objectEntries } from '@oldschoolgg/toolkit';
import { Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { duradelTasks } from '@/lib/slayer/tasks/duradelTasks.js';
import { allSlayerTasks } from '@/lib/slayer/tasks/index.js';
import { konarTasks } from '@/lib/slayer/tasks/konarTasks.js';
import {
	canonicalSlayerTaskMonsterID,
	isMetalDragonTaskID,
	METAL_DRAGON_CANONICAL_ID,
	METAL_DRAGON_TASK_IDS
} from '@/lib/slayer/tasks/metalDragonTask.js';
import { nieveTasks } from '@/lib/slayer/tasks/nieveTasks.js';
import { SlayerTaskUnlocksEnum } from '../../src/lib/slayer/slayerUnlocks.js';

describe('Slayer', () => {
	test('All slayer task monster lists should contain their main monster id', () => {
		for (const task of allSlayerTasks) {
			expect(task.monsters).toContain(task.monster.id);
		}
	});

	test('Metal dragon tasks are unified for Konar, Nieve and Duradel', () => {
		const masters = [
			{ name: 'Konar', tasks: konarTasks, amount: [30, 40], weight: 15 },
			{ name: 'Nieve', tasks: nieveTasks, amount: [30, 40], weight: 12 },
			{ name: 'Duradel', tasks: duradelTasks, amount: [35, 45], weight: 14 }
		] as const;

		for (const master of masters) {
			const metalDragonTasks = master.tasks.filter(task => isMetalDragonTaskID(task.monster.id));
			expect(metalDragonTasks, master.name).toHaveLength(1);

			const [task] = metalDragonTasks;
			expect(task.monster.id).toBe(Monsters.BronzeDragon.id);
			expect(task.amount).toEqual(master.amount);
			expect(task.extendedAmount).toEqual([150, 200]);
			expect(task.weight).toBe(master.weight);
			expect(task.extendedUnlockId).toBe(SlayerTaskUnlocksEnum.PedalToTheMetals);
			expect(task.monsters).toEqual([...METAL_DRAGON_TASK_IDS]);
		}
	});

	test('Metal dragon task IDs map to a single canonical slayer task ID', () => {
		for (const monsterID of METAL_DRAGON_TASK_IDS) {
			expect(canonicalSlayerTaskMonsterID(monsterID)).toBe(METAL_DRAGON_CANONICAL_ID);
		}

		expect(canonicalSlayerTaskMonsterID(Monsters.BlackDragon.id)).toBe(Monsters.BlackDragon.id);
	});

	test('Snapshot the values of the slayer unlocks enum', () => {
		const copy = { ...SlayerTaskUnlocksEnum };
		for (const [key, value] of objectEntries(copy)) {
			if (typeof value === 'string') {
				delete copy[key];
			}
		}
		writeFileSync('./tests/unit/snapshots/slayerUnlocks.snapshot.json', `${JSON.stringify(copy, null, '	')}\n`);
	});
});
