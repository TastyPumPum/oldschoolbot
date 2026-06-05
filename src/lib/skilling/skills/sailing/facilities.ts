import { Bank } from 'oldschooljs';

export type SailingFacilityId =
	| 'salvaging_hook'
	| 'fishing_station'
	| 'racing_sails'
	| 'inoculation_station'
	| 'wind_catcher'
	| 'gale_catcher'
	| 'crystal_extractor';

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
		id: 'fishing_station',
		name: 'Fishing station',
		level: 20,
		cost: new Bank({ 'Fishing net': 2, Rope: 6, Sails: 1 }),
		description: 'Enables deep sea trawling.'
	},
	{
		id: 'racing_sails',
		name: 'Racing sails',
		level: 25,
		cost: new Bank({ Sails: 1, Rope: 6, 'Bolt of cloth': 20 }),
		description: 'Enables Barracuda Trials.'
	},
	{
		id: 'inoculation_station',
		name: 'Inoculation station',
		level: 50,
		constructionLevel: 55,
		cost: new Bank({ 'Mithril bar': 6, Rope: 6, 'Oak plank': 12 }),
		description: 'Required for higher-tier Barracuda Trials.'
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
		description: 'Stores two wind motes for Sailing speed boosts.'
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
		description: 'Stores three wind motes for Sailing speed boosts.'
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
		requiredItems: new Bank({ 'Heart of Ithell': 1 }),
		description: 'Grants periodic Sailing XP during trips.'
	}
];

export const SailingFacilitiesById = new Map(SailingFacilities.map(f => [f.id, f]));
