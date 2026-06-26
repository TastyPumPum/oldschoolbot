import { itemID, resolveItems } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { capesCL, skillingPetsCL } from '@/lib/data/CollectionsExport.js';
import { QuestID } from '@/lib/minions/data/quests.js';
import { getMaxPortTasks, getPortTaskXPHour } from '@/lib/skilling/skills/sailing/activities.js';
import { BarracudaTrialById } from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import {
	isSalvagingHookFacility,
	SailingFacilities,
	SailingFacilitiesById
} from '@/lib/skilling/skills/sailing/facilities.js';
import { canGainSailingXP } from '@/lib/skilling/skills/sailing/sailingXPUnlock.js';
import { SalvagingShipwrecks } from '@/lib/skilling/skills/sailing/salvaging.js';
import { getSeaChartingProgress } from '@/lib/skilling/skills/sailing/seaCharting.js';
import { getActiveShipType, getInstalledFacilities, getShipParts } from '@/lib/skilling/skills/sailing/ship.js';
import {
	bankFromSailingCost,
	normaliseShipParts,
	SailingShipTypeById,
	SailingStructuralParts,
	tierMeetsRequirement
} from '@/lib/skilling/skills/sailing/shipParts.js';
import {
	canTrawlAtDepth,
	getTrawlingCatchChance,
	TrawlingNetById,
	TrawlingShoalById
} from '@/lib/skilling/skills/sailing/trawling.js';
import { calculatePassiveSailingActions, STARTER_SAIL_TRIM_DATA } from '@/lib/skilling/skills/sailing/upgrades.js';
import { type SkillNameType, SkillsArray } from '@/lib/skilling/types.js';
import { getLowestTearsOfGuthixSkill } from '@/tasks/minions/minigames/tearsOfGuthixActivity.js';

describe('Sailing data', () => {
	test('requires Pandemonium before Sailing XP can be gained', () => {
		expect(canGainSailingXP({ user: { finished_quest_ids: [] } })).toBe(false);
		expect(canGainSailingXP({ user: { finished_quest_ids: [QuestID.Pandemonium] } })).toBe(true);
	});

	test('does not pick Sailing for Tears of Guthix before Pandemonium', () => {
		const skillsAsXP = Object.fromEntries(
			SkillsArray.map(skill => [skill, skill === 'sailing' ? 0 : 1000])
		) as Record<SkillNameType, number>;
		const skillsAsLevels = Object.fromEntries(
			SkillsArray.map(skill => [skill, skill === 'sailing' ? 1 : 10])
		) as Record<SkillNameType, number>;

		expect(getLowestTearsOfGuthixSkill({ user: { finished_quest_ids: [] }, skillsAsLevels, skillsAsXP })).toBe(
			'agility'
		);
		expect(
			getLowestTearsOfGuthixSkill({
				user: { finished_quest_ids: [QuestID.Pandemonium] },
				skillsAsLevels,
				skillsAsXP
			})
		).toBe('sailing');
	});

	test('includes Sailing collection log entries', () => {
		expect(capesCL).toEqual(
			expect.arrayContaining(resolveItems(['Sailing hood', 'Sailing cape', 'Sailing cape(t)']))
		);
		expect(skillingPetsCL).toContain(itemID('Soup'));
	});

	test('uses OSRS port-task slots and documented approximate rates', () => {
		expect([1, 6, 7, 27, 28, 55, 56, 83, 84, 99].map(getMaxPortTasks)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
		expect(getPortTaskXPHour('courier', 46)).toBe(30_000);
		expect(getPortTaskXPHour('courier', 84)).toBe(135_000);
		expect(getPortTaskXPHour('bounty', 30)).toBe(18_000);
		expect(getPortTaskXPHour('bounty', 80)).toBe(95_000);
	});

	test('summarises Sea charting progress by ocean', () => {
		const progress = getSeaChartingProgress([0, 1, 2, 343]);

		expect(progress.completed).toBe(4);
		expect(progress.total).toBe(358);
		expect(progress.oceans.map(ocean => ocean.ocean)).toEqual([
			'Ardent Ocean',
			'Sunset Ocean',
			'Unquiet Ocean',
			'Western Ocean',
			'Shrouded Ocean',
			'Northern Ocean',
			'Bonus charts'
		]);
		expect(progress.oceans.find(ocean => ocean.ocean === 'Ardent Ocean')).toMatchObject({
			completed: 2,
			total: 69
		});
		expect(progress.oceans.find(ocean => ocean.ocean === 'Bonus charts')).toMatchObject({
			completed: 1,
			total: 33
		});
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
		expect(
			SailingFacilities.filter(facility => isSalvagingHookFacility(facility.id)).map(facility => facility.id)
		).toEqual([
			'salvaging_hook',
			'iron_salvaging_hook',
			'steel_salvaging_hook',
			'mithril_salvaging_hook',
			'adamant_salvaging_hook',
			'rune_salvaging_hook',
			'dragon_salvaging_hook'
		]);
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

	test('models OSRS ship types and structural part requirements', () => {
		expect(SailingShipTypeById.get('raft')).toMatchObject({ sailingLevel: 1, facilityHotspots: 1 });
		expect(SailingShipTypeById.get('skiff')).toMatchObject({ sailingLevel: 15, facilityHotspots: 7 });
		expect(SailingShipTypeById.get('sloop')).toMatchObject({ sailingLevel: 50, facilityHotspots: 13 });
		expect(normaliseShipParts()).toEqual({
			shipType: 'raft',
			hull: 'wooden',
			helm: 'bronze',
			mast_sails: 'wooden_linen',
			keel: undefined
		});
		expect(normaliseShipParts(undefined, 'skiff')).toMatchObject({
			shipType: 'skiff',
			hull: 'wooden',
			helm: 'bronze',
			mast_sails: 'wooden_linen',
			keel: 'bronze'
		});

		expect(tierMeetsRequirement('helm', 'mithril', 'iron')).toBe(true);
		expect(tierMeetsRequirement('helm', 'iron', 'mithril')).toBe(false);
		expect(tierMeetsRequirement('keel', 'adamant', 'adamant')).toBe(true);
		expect(tierMeetsRequirement('mast_sails', 'oak_linen', 'oak_linen')).toBe(true);
		expect(tierMeetsRequirement('mast_sails', 'wooden_linen', 'oak_linen')).toBe(false);
	});

	test('defaults active ship data to the raft and keeps configured ships separate', () => {
		const ship = {
			upgrades_bank: {
				activeShipType: 'skiff',
				ships: {
					raft: { facilities: ['salvaging_hook'] },
					skiff: { facilities: ['inoculation_station'], parts: { shipType: 'skiff', helm: 'mithril' } }
				}
			}
		} as never;

		expect(getActiveShipType(ship)).toBe('skiff');
		expect(getInstalledFacilities(ship)).toEqual(['inoculation_station']);
		expect(getInstalledFacilities(ship, 'raft')).toEqual(['salvaging_hook']);
		expect(getShipParts(ship)).toMatchObject({ shipType: 'skiff', helm: 'mithril', keel: 'bronze' });
	});

	test('stores OSRS structural recipes without inventing missing items', () => {
		const adamantSkiffKeel = SailingStructuralParts.find(part => part.id === 'adamant_skiff_keel')!;
		expect(adamantSkiffKeel).toMatchObject({
			name: 'Adamant skiff keel',
			level: 66,
			constructionLevel: 62,
			cost: {
				'Adamant skiff keel parts': 10,
				'Lead bar': 5
			}
		});
		const { bank, missingItems } = bankFromSailingCost(adamantSkiffKeel.cost);
		expect(bank.toString()).toBe('5x Lead bar');
		expect(missingItems).toEqual(['10x Adamant skiff keel parts']);
	});

	test('uses structural ship requirements for Barracuda Trials', () => {
		expect(BarracudaTrialById.get('tempor_tantrum')?.shipRequirement).toEqual({
			shipType: 'skiff',
			parts: {
				helm: 'iron',
				mast_sails: 'oak_linen'
			}
		});
		expect(BarracudaTrialById.get('jubbly_jive')?.shipRequirement).toEqual({
			shipType: 'skiff',
			parts: {
				helm: 'mithril'
			}
		});
		expect(BarracudaTrialById.get('gwenith_glide')?.shipRequirement).toEqual({
			shipType: 'skiff',
			parts: {
				keel: 'adamant'
			}
		});
		expect(BarracudaTrialById.get('gwenith_glide')?.requiredAnyFacilities).toBeUndefined();
	});

	test('uses the starter sail trim XP until real sail parts are modelled', () => {
		expect(STARTER_SAIL_TRIM_DATA).toEqual({ level: 1, xp: 10.5 });
	});

	test('automatically trims sails and releases generated motes', () => {
		expect(
			calculatePassiveSailingActions({
				duration: 120_000,
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
			expect(shipwreck.salvagePerAction).toBe(12);
		}
		expect(SalvagingShipwrecks.find(shipwreck => shipwreck.id === 'barracuda')?.lootTable.totalWeight).toBe(27_151);
	});
});
