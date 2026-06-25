import { describe, expect, test } from 'vitest';

import type { UserShip } from '@/prisma/main.js';
import { getMaxPortTasks } from '@/lib/skilling/skills/sailing/activities.js';
import { SailingFacilitiesById } from '@/lib/skilling/skills/sailing/facilities.js';
import { SalvagingShipwrecks } from '@/lib/skilling/skills/sailing/salvaging.js';
import { addStoredWindMotes, getStoredWindMotes, getWindMoteCapacity } from '@/lib/skilling/skills/sailing/ship.js';
import {
	canTrawlAtDepth,
	getTrawlingCatchChance,
	TrawlingNetById,
	TrawlingShoalById
} from '@/lib/skilling/skills/sailing/trawling.js';
import { getSailTierTrimData } from '@/lib/skilling/skills/sailing/upgrades.js';

function mockShip(upgrades: Record<string, unknown>): UserShip {
	return {
		user_id: '1',
		ship_name: null,
		hull_tier: 1,
		sails_tier: 1,
		crew_tier: 1,
		navigation_tier: 1,
		cargo_tier: 1,
		upgrades_bank: upgrades
	} as UserShip;
}

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

	test('stores wind motes up to catcher capacity', () => {
		const ship = mockShip({ facilities: ['wind_catcher'], windMotes: { normal: 1, extractor: 0 } });
		expect(getWindMoteCapacity(ship)).toBe(2);
		expect(addStoredWindMotes(ship, 5, 'extractor')).toEqual({ normal: 1, extractor: 1 });
		expect(getStoredWindMotes(ship)).toEqual({ normal: 1, extractor: 0 });
	});

	test('uses the first five OSRS sail trim tiers', () => {
		expect(getSailTierTrimData(1)).toEqual({ level: 1, xp: 10.5 });
		expect(getSailTierTrimData(5)).toEqual({ level: 68, xp: 64 });
	});

	test('constructs all supported salvage tables at their sourced weights', () => {
		for (const shipwreck of SalvagingShipwrecks) {
			expect(shipwreck.lootTable.totalWeight).toBeLessThanOrEqual(shipwreck.lootTable.limit!);
			expect(shipwreck.lootTable.allItems.length).toBeGreaterThan(0);
		}
		expect(SalvagingShipwrecks.find(shipwreck => shipwreck.id === 'barracuda')?.lootTable.totalWeight).toBe(27_151);
	});
});
