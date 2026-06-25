import { Bank } from 'oldschooljs';

import { type TrawlingNetId, TrawlingNets } from '@/lib/skilling/skills/sailing/trawling.js';

export type SailingFacilityId =
	| 'salvaging_hook'
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
	description: string;
}

export const SailingFacilities: SailingFacility[] = [
	{
		id: 'salvaging_hook',
		name: 'Bronze salvaging hook',
		level: 15,
		constructionLevel: 1,
		cost: new Bank({ Plank: 4, 'Bronze nails': 16, 'Bronze bar': 6, Rope: 1 }),
		description: 'Enables shipwreck salvaging.'
	},
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
		description: 'Allows salvage to be sorted aboard the ship.'
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
			'Magic stone': 2,
			'Heart of Ithell': 1
		}),
		description: 'Automatically grants periodic Sailing XP and extractor motes during trips.'
	},
	...TrawlingNets.map(net => ({
		id: net.id,
		name: net.name,
		level: net.level,
		constructionLevel: net.constructionLevel,
		cost: net.cost,
		description: `Enables deep sea trawling at ${net.depths.join(', ')} depths.`
	}))
];

export const SailingFacilitiesById = new Map(SailingFacilities.map(f => [f.id, f]));
