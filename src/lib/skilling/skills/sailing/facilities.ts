import { Bank } from 'oldschooljs';

import {
	bankFromSailingCost,
	type SailingCost,
	type SailingShipType
} from '@/lib/skilling/skills/sailing/shipParts.js';
import { type TrawlingNetId, TrawlingNets } from '@/lib/skilling/skills/sailing/trawling.js';

export type SailingFacilityId =
	| 'salvaging_hook'
	| 'iron_salvaging_hook'
	| 'steel_salvaging_hook'
	| 'mithril_salvaging_hook'
	| 'adamant_salvaging_hook'
	| 'rune_salvaging_hook'
	| 'dragon_salvaging_hook'
	| 'inoculation_station'
	| 'salvaging_station'
	| 'keg'
	| 'wind_catcher'
	| 'gale_catcher'
	| 'crystal_extractor'
	| TrawlingNetId;

export interface SailingFacility {
	id: SailingFacilityId;
	name: string;
	level: number;
	constructionLevel?: number;
	requiredItems?: Bank;
	cost: Bank;
	missingCostItems?: string[];
	family?: 'salvaging_hook' | 'trawling_net' | 'wind_catcher';
	shipTypes?: SailingShipType[];
	description: string;
}

function facilityCost(cost: SailingCost) {
	return bankFromSailingCost(cost);
}

function salvagingHook({
	id,
	name,
	level,
	constructionLevel,
	cost,
	description
}: {
	id: SailingFacilityId;
	name: string;
	level: number;
	constructionLevel: number;
	cost: SailingCost;
	description: string;
}): SailingFacility {
	const { bank, missingItems } = facilityCost(cost);
	return {
		id,
		name,
		level,
		constructionLevel,
		cost: bank,
		missingCostItems: missingItems,
		family: 'salvaging_hook',
		description
	};
}

export const SailingFacilities: SailingFacility[] = [
	salvagingHook({
		id: 'salvaging_hook',
		name: 'Bronze salvaging hook',
		level: 15,
		constructionLevel: 1,
		cost: { Plank: 4, 'Bronze nails': 16, 'Bronze bar': 6, Rope: 1 },
		description: 'Enables shipwreck salvaging.'
	}),
	salvagingHook({
		id: 'iron_salvaging_hook',
		name: 'Iron salvaging hook',
		level: 21,
		constructionLevel: 9,
		cost: { 'Oak plank': 4, 'Iron nails': 16, 'Iron bar': 6, Rope: 1 },
		description: 'Improves shipwreck salvaging.'
	}),
	salvagingHook({
		id: 'steel_salvaging_hook',
		name: 'Steel salvaging hook',
		level: 27,
		constructionLevel: 18,
		cost: { 'Teak plank': 4, 'Steel nails': 16, 'Steel bar': 8, Rope: 1, 'Lead bar': 3 },
		description: 'Improves shipwreck salvaging.'
	}),
	salvagingHook({
		id: 'mithril_salvaging_hook',
		name: 'Mithril salvaging hook',
		level: 44,
		constructionLevel: 30,
		cost: { 'Mahogany plank': 4, 'Mithril nails': 16, 'Mithril bar': 6, Rope: 1, 'Lead bar': 3 },
		description: 'Improves shipwreck salvaging.'
	}),
	salvagingHook({
		id: 'adamant_salvaging_hook',
		name: 'Adamant salvaging hook',
		level: 59,
		constructionLevel: 52,
		cost: { 'Camphor plank': 4, 'Adamantite nails': 16, 'Adamantite bar': 6, Rope: 1, 'Lead bar': 3 },
		description: 'Improves shipwreck salvaging.'
	}),
	salvagingHook({
		id: 'rune_salvaging_hook',
		name: 'Rune salvaging hook',
		level: 74,
		constructionLevel: 66,
		cost: {
			'Ironwood plank': 6,
			'Rune nails': 16,
			'Runite bar': 6,
			Rope: 1,
			'Lead bar': 4,
			'Cupronickel bar': 4
		},
		description: 'Improves shipwreck salvaging.'
	}),
	salvagingHook({
		id: 'dragon_salvaging_hook',
		name: 'Dragon salvaging hook',
		level: 86,
		constructionLevel: 78,
		cost: {
			'Rosewood plank': 7,
			'Dragon nails': 16,
			'Dragon metal sheet': 6,
			Rope: 1,
			'Cupronickel bar': 4,
			'Broken dragon hook': 1
		},
		description: 'Best shipwreck salvaging hook.'
	}),
	{
		id: 'inoculation_station',
		name: 'Inoculation station',
		level: 40,
		constructionLevel: 37,
		cost: new Bank({ 'Teak plank': 8, 'Steel nails': 32, "Relicym's balm(4)": 6 }),
		description: 'Protects the ship from fetid waters and is required for The Jubbly Jive.'
	},
	{
		id: 'keg',
		name: 'Keg',
		level: 33,
		constructionLevel: 25,
		cost: new Bank({ 'Oak plank': 5, 'Iron nails': 20, 'Barrel stand': 1 }),
		description: 'Stores charting ales. Ale effects are not yet modelled.'
	},
	{
		id: 'salvaging_station',
		name: 'Salvaging station',
		level: 42,
		constructionLevel: 34,
		cost: new Bank({ 'Teak plank': 4, 'Steel nails': 16 }),
		description: 'Automatically sorts salvage while shipwreck salvaging at sea.'
	},
	{
		id: 'wind_catcher',
		name: 'Wind catcher',
		level: 53,
		constructionLevel: 47,
		cost: new Bank({
			'Teak plank': 4,
			'Steel nails': 16,
			'Steel bar': 8,
			'Lead bar': 4,
			'Air rune': 10_000
		}),
		requiredItems: new Bank({ 'Captured wind mote': 1 }),
		description: 'Automatically catches and releases wind motes during Sailing trips.'
	},
	{
		id: 'gale_catcher',
		name: 'Gale catcher',
		level: 79,
		constructionLevel: 70,
		cost: new Bank({
			'Camphor plank': 4,
			'Adamantite nails': 16,
			'Adamantite bar': 8,
			'Cupronickel bar': 4,
			'Air rune': 25_000,
			'Swift albatross feather': 5
		}),
		requiredItems: new Bank({ 'Captured wind mote': 1 }),
		description: 'Automatically catches and releases stronger wind motes during Sailing trips.'
	},
	{
		id: 'crystal_extractor',
		name: 'Crystal extractor',
		level: 73,
		constructionLevel: 67,
		cost: new Bank({
			'Ironwood plank': 6,
			'Cupronickel bar': 5,
			'Magic stone': 2
		}),
		requiredItems: new Bank({ 'Heart of ithell': 1 }),
		description: 'Automatically grants periodic Sailing XP and extractor motes during trips.'
	},
	...TrawlingNets.map(net => ({
		id: net.id,
		name: net.name,
		level: net.level,
		constructionLevel: net.constructionLevel,
		cost: net.cost,
		family: 'trawling_net' as const,
		description: `Enables deep sea trawling at ${net.depths.join(', ')} depths.`
	}))
];

export const SailingFacilitiesById = new Map(SailingFacilities.map(f => [f.id, f]));

export function isSalvagingHookFacility(facility: SailingFacilityId): boolean {
	return SailingFacilitiesById.get(facility)?.family === 'salvaging_hook';
}
