import { describe, expect, test } from 'vitest';

import { getMaxPortTasks } from '@/lib/skilling/skills/sailing/activities.js';
import { SailingFacilitiesById } from '@/lib/skilling/skills/sailing/facilities.js';
import { SalvagingShipwrecks } from '@/lib/skilling/skills/sailing/salvaging.js';
import {
	canTrawlAtDepth,
	getTrawlingCatchChance,
	TrawlingNetById,
	TrawlingShoalById
} from '@/lib/skilling/skills/sailing/trawling.js';
import { calculatePassiveSailingActions, getSailTierTrimData } from '@/lib/skilling/skills/sailing/upgrades.js';

describe('Sailing data', () => {
	test('uses OSRS port task slot thresholds', () => {
		expect([1, 6, 7, 27, 28, 55, 56, 83, 84, 99].map(getMaxPortTasks)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
	});

	test('uses OSRS trawling requirements and catch chances', () => {
		const ropeNet = TrawlingNetById.get('rope_trawling_net')!;
		const hempNet = TrawlingNetById.get('hemp_trawling_net')!;
		const krill = TrawlingShoalById.get('giant_krill')!;
		const marlin = TrawlingShoalById.get('marlin_shoal')!;

		expect(ropeNet).toMatchObject({ level: 56, constructionLevel: 45, maxFishPerCatch: 2, sailingXP: 7 });
		expect(hempNet).toMatchObject({ level: 76, constructionLevel: 70, maxFishPerCatch: 4, sailingXP: 11 });
		expect(canTrawlAtDepth(ropeNet, 'deep')).toBe(false);
		expect(canTrawlAtDepth(hempNet, 'deep')).toBe(true);
		expect(getTrawlingCatchChance(krill, 68)).toBe(0);
		expect(getTrawlingCatchChance(krill, 69)).toBe(15);
		expect(getTrawlingCatchChance(krill, 99)).toBe(30);
		expect(getTrawlingCatchChance(marlin, 91)).toBe(4);
		expect(getTrawlingCatchChance(marlin, 99)).toBe(20);
	});

	test('uses corrected facilities and removes invented facilities', () => {
		expect(SailingFacilitiesById.has('fishing_station' as never)).toBe(false);
		expect(SailingFacilitiesById.has('racing_sails' as never)).toBe(false);
		expect(SailingFacilitiesById.get('inoculation_station')).toMatchObject({
			level: 40,
			constructionLevel: 37
		});
		expect(SailingFacilitiesById.get('salvaging_station')).toMatchObject({
			level: 42,
			constructionLevel: 34
		});
		expect(SailingFacilitiesById.get('keg')).toMatchObject({ level: 33, constructionLevel: 25 });
	});

	test('uses the first five OSRS sail trim tiers', () => {
		expect(getSailTierTrimData(1)).toEqual({ level: 1, xp: 10.5 });
		expect(getSailTierTrimData(5)).toEqual({ level: 68, xp: 64 });
	});

	test('automatically trims sails and releases generated motes', () => {
		expect(
			calculatePassiveSailingActions({
				duration: 120_000,
				sailsTier: 1,
				sailingLevel: 99,
				facilities: ['wind_catcher']
			})
		).toEqual({
			trims: 4,
			trimXP: 31.5,
			trimMoteXP: 160,
			extractorHarvests: 0,
			extractorXP: 0,
			extractorMoteXP: 0,
			totalXP: 191.5
		});

		expect(
			calculatePassiveSailingActions({
				duration: 126_000,
				sailsTier: 1,
				sailingLevel: 99,
				facilities: ['wind_catcher', 'crystal_extractor']
			})
		).toMatchObject({
			extractorHarvests: 2,
			extractorXP: 500,
			extractorMoteXP: 20
		});
	});

	test('constructs all supported salvage tables at their sourced weights', () => {
		for (const shipwreck of SalvagingShipwrecks) {
			expect(shipwreck.lootTable.totalWeight).toBeLessThanOrEqual(shipwreck.lootTable.limit!);
			expect(shipwreck.lootTable.allItems.length).toBeGreaterThan(0);
		}
		expect(SalvagingShipwrecks.find(shipwreck => shipwreck.id === 'barracuda')?.lootTable.totalWeight).toBe(27_151);
	});
});
