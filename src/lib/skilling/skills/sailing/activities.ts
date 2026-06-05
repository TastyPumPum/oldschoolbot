import { Time } from '@oldschoolgg/toolkit';
import { LootTable } from 'oldschooljs';

import { BarracudaTrials } from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';
import { type SalvagingShipwreckId, SalvagingShipwrecks } from '@/lib/skilling/skills/sailing/salvaging.js';
import type { ShipPart } from '@/lib/skilling/skills/sailing/upgrades.js';

export type SailingActivityId =
	| 'sea_charting'
	| 'port_tasks'
	| 'shipwreck_salvaging'
	| 'tempor_tantrum'
	| 'jubbly_jive'
	| 'gwenith_glide'
	| 'deep_sea_trawling';

export interface SailingActivity {
	id: SailingActivityId;
	name: string;
	level: number;
	xp: number;
	baseTime: number;
	// Failure chance per action before ship bonuses (0-1)
	baseRisk: number;
	lootTable: LootTable;
	petChance: number;
	reputation: number;
	allowedDifficulties?: ReadonlyArray<'easy' | 'standard' | 'hard' | 'elite'>;
	hazards?: Array<{ name: string; chance: number; effect: 'fail' | 'delay' | 'damage' }>;
	variants?: Array<{
		id: 'courier' | 'bounty' | 'swordfish' | 'shark' | 'marlin' | SalvagingShipwreckId;
		name: string;
		xpMultiplier: number;
		lootMultiplier: number;
		timeMultiplier?: number;
		lootTable: LootTable;
	}>;
	requiredShipTiers?: Partial<Record<ShipPart, number>>;
	requiredItems?: string[];
	requiredFacility?: SailingFacilityId;
	requiredAnyFacilities?: SailingFacilityId[];
	requiredReputation?: number;
	qpRequired?: number;
}

const SeaChartingTable = new LootTable();

const PortTasksTable = new LootTable()
	.add('Coins', [250, 650], 12)
	.add('Oak plank', [1, 2], 3)
	.add('Rope', 1, 2)
	.add('Coconut', 1, 1)
	.add('Shipping order', 1, 1)
	.oneIn(120, 'Shipping contract');

const DeepSeaTrawlingTable = new LootTable()
	.add('Raw shark', [1, 3], 4)
	.add('Raw manta ray', [1, 2], 2)
	.add('Seaweed', [5, 10], 3)
	.add('Harpoonfish', 1, 1)
	.oneIn(140, 'Clue bottle (easy)')
	.oneIn(220, "Trawler's trust");

export const SailingActivities: SailingActivity[] = [
	{
		id: 'sea_charting',
		name: 'Sea charting',
		level: 1,
		xp: 0,
		baseTime: Time.Minute * 1.5,
		baseRisk: 0,
		lootTable: SeaChartingTable,
		petChance: 0,
		reputation: 2,
		allowedDifficulties: ['easy', 'standard'],
		hazards: [{ name: 'Sudden squall', chance: 0.04, effect: 'fail' }]
	},
	{
		id: 'port_tasks',
		name: 'Port tasks',
		level: 1,
		xp: 200,
		baseTime: Time.Minute * 2,
		baseRisk: 0.04,
		lootTable: PortTasksTable,
		petChance: 400_000,
		reputation: 0,
		allowedDifficulties: ['standard' as const],
		variants: [
			{
				id: 'courier',
				name: 'Courier',
				xpMultiplier: 1,
				lootMultiplier: 1.05,
				lootTable: new LootTable().add('Coins', [200, 500], 5).add('Shipping order', 1, 2)
			},
			{
				id: 'bounty',
				name: 'Bounty',
				xpMultiplier: 1.15,
				lootMultiplier: 1.1,
				lootTable: new LootTable().add('Coins', [300, 700], 5).add('Sealed message', 1, 1)
			}
		]
	},
	{
		id: 'shipwreck_salvaging',
		name: 'Shipwreck salvaging',
		level: 15,
		xp: 0,
		baseTime: Time.Minute,
		baseRisk: 0,
		lootTable: new LootTable(),
		petChance: 0,
		reputation: 0,
		allowedDifficulties: ['standard' as const],
		requiredFacility: 'salvaging_hook',
		variants: SalvagingShipwrecks.map(shipwreck => ({
			id: shipwreck.id,
			name: shipwreck.name,
			xpMultiplier: 1,
			lootMultiplier: 1,
			timeMultiplier: shipwreck.averageDuration / Time.Minute,
			lootTable: new LootTable()
		}))
	},
	...BarracudaTrials.map(trial => ({
		id: trial.id,
		name: trial.name,
		level: trial.level,
		xp: trial.ranks[0].xp,
		baseTime: trial.ranks[0].targetTime,
		baseRisk: 0,
		lootTable: new LootTable(),
		petChance: 0,
		reputation: 0,
		allowedDifficulties: ['standard' as const],
		requiredFacility: trial.requiredFacility,
		requiredAnyFacilities: trial.requiredAnyFacilities,
		variants: trial.ranks.map(rank => ({
			id: rank.id,
			name: rank.name,
			xpMultiplier: 1,
			lootMultiplier: 1,
			timeMultiplier: rank.targetTime / trial.ranks[0].targetTime,
			lootTable: new LootTable()
		}))
	})),
	{
		id: 'deep_sea_trawling',
		name: 'Deep sea trawling',
		level: 35,
		xp: 360,
		baseTime: Time.Minute * 4,
		baseRisk: 0.14,
		lootTable: DeepSeaTrawlingTable,
		petChance: 200_000,
		reputation: 0,
		allowedDifficulties: ['standard'],
		requiredFacility: 'fishing_station',
		requiredReputation: undefined
	}
];

export const SailingActivityById = new Map(SailingActivities.map(activity => [activity.id, activity]));
