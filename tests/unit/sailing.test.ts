import { Time } from '@oldschoolgg/toolkit';
import { Bank, Items } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { rollOceanEncounters } from '@/lib/skilling/skills/sailing/encounters.js';
import { SailingFacilitiesById } from '@/lib/skilling/skills/sailing/facilities.js';
import {
	seaChartingCompletionBonuses,
	seaChartingTaskById,
	userCanDoSeaChartingTask
} from '@/lib/skilling/skills/sailing/seaCharting.js';
import { getTrawlingCatchChance, TrawlingNetById, TrawlingShoalById } from '@/lib/skilling/skills/sailing/trawling.js';
import { calculatePassiveSailingActions, sailTrimXP } from '@/lib/skilling/skills/sailing/upgrades.js';

describe('Sailing', () => {
	test('Charting enforces mandatory boats, not recommended boats', () => {
		const user = {
			skillsAsLevels: { sailing: 99 },
			user: { finished_quest_ids: [19, 20, 21, 22] },
			owns: () => true
		} as unknown as MUser;
		for (const id of [210, 261]) {
			const task = seaChartingTaskById.get(id)!;
			expect(userCanDoSeaChartingTask(user, task, 'raft')).toBe(true);
			expect(userCanDoSeaChartingTask(user, task, 'skiff')).toBe(false);
		}
		expect(userCanDoSeaChartingTask(user, seaChartingTaskById.get(170)!, 'skiff')).toBe(true);
		expect(userCanDoSeaChartingTask(user, seaChartingTaskById.get(170)!, 'sloop')).toBe(false);
		expect(userCanDoSeaChartingTask(user, seaChartingTaskById.get(39)!, 'sloop')).toBe(true);
		expect(seaChartingCompletionBonuses.find(bonus => bonus.sea === 'Mythic Sea')!.xp).toBe(4430);
	});
	test('Installed sails determine trimming XP, including catcher penalties', () => {
		for (const sails of Object.keys(sailTrimXP) as (keyof typeof sailTrimXP)[]) {
			const result = calculatePassiveSailingActions({ duration: 60_000, sailingLevel: 1, facilities: [], sails });
			expect(result.trims).toBe(2);
			expect(result.totalXP).toBe(2 * sailTrimXP[sails]);
			const catcher = calculatePassiveSailingActions({
				duration: 60_000,
				sailingLevel: 1,
				facilities: ['wind_catcher'],
				sails
			});
			expect(catcher.trimXP).toBe(result.trimXP * 0.75);
			expect(catcher.trimMoteXP).toBe(80);
		}
	});

	test('Passive actions only count completed intervals', () => {
		expect(calculatePassiveSailingActions({ duration: 29_999, sailingLevel: 99, facilities: [] }).totalXP).toBe(0);
		const result = calculatePassiveSailingActions({
			duration: 63_000,
			sailingLevel: 99,
			facilities: ['crystal_extractor', 'gale_catcher']
		});
		expect(result.extractorHarvests).toBe(1);
		expect(result.extractorXP).toBe(250);
		expect(result.extractorMoteXP).toBe(10);
	});

	test('Trawling uses rounded OSRS success values out of 256', () => {
		const shoal = TrawlingShoalById.get('bluefin')!;
		expect(getTrawlingCatchChance(shoal, 86)).toBe(0);
		expect(getTrawlingCatchChance(shoal, 87)).toBe((22 / 256) * 100);
		expect(getTrawlingCatchChance(shoal, 99)).toBe((24 / 256) * 100);
	});

	test('A prepared clam item yields only one pearl per trip', () => {
		const result = rollOceanEncounters({
			duration: 10 * Time.Minute,
			sailingLevel: 40,
			facilities: [],
			clamItemId: Items.getOrThrow('Coins').id,
			clamFedAt: Date.now() - 2 * Time.Hour,
			user: { bank: new Bank() } as MUser,
			rng: { randInt: () => 1 } as unknown as RNGProvider,
			allowedEncounters: ['giant_clam']
		});
		expect(result.encounters).toBeGreaterThan(1);
		expect(result.loot.amount('Tiny pearl')).toBe(1);
		expect(result.xp).toBe(600);
		expect(result.clamConsumed).toBe(true);
	});

	test('Strong wind trimming respects installed sails', () => {
		const result = rollOceanEncounters({
			duration: 72_000,
			sailingLevel: 99,
			facilities: [],
			sails: 'rosewood_cotton',
			user: { bank: new Bank() } as MUser,
			rng: { randInt: () => 1 } as unknown as RNGProvider,
			allowedEncounters: ['strong_winds']
		});
		expect(result.xp).toBe(500);
	});

	test('Recipes retain tools and use sourced quantities and boat restrictions', () => {
		const keg = SailingFacilitiesById.get('keg')!;
		expect(keg.cost.amount('Barrel stand')).toBe(0);
		expect(keg.requiredItems!.amount('Barrel stand')).toBe(1);
		expect(SailingFacilitiesById.get('steel_salvaging_hook')!.cost.amount('Steel bar')).toBe(6);
		expect(TrawlingNetById.get('hemp_trawling_net')!.constructionLevel).toBe(65);
		expect(SailingFacilitiesById.get('salvaging_station')!.shipTypes).toEqual(['skiff', 'sloop']);
		for (const net of TrawlingNetById.values()) {
			expect(SailingFacilitiesById.get(net.id)!.shipTypes).toEqual(['skiff', 'sloop']);
		}
	});
});
