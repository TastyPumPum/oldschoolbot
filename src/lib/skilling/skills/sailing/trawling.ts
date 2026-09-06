import { Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';

export type TrawlingNetId = 'rope_trawling_net' | 'linen_trawling_net' | 'hemp_trawling_net' | 'cotton_trawling_net';

export type TrawlingShoalId = 'giant_krill' | 'haddock' | 'yellowfin' | 'halibut' | 'bluefin' | 'marlin_shoal';

export type TrawlingDepth = 'shallow' | 'moderate' | 'deep';

export interface TrawlingNet {
	id: TrawlingNetId;
	name: string;
	level: number;
	constructionLevel: number;
	maxFishPerCatch: number;
	sailingXP: number;
	depths: TrawlingDepth[];
	cost: Bank;
}

export interface TrawlingShoal {
	id: TrawlingShoalId;
	name: string;
	fish: string;
	fishingLevel: number;
	fishingXP: number;
	depth: TrawlingDepth;
	catchChanceLow: number;
	catchChanceHigh: number;
	stopDuration: number;
}

export const TrawlingNets: TrawlingNet[] = [
	{
		id: 'rope_trawling_net',
		name: 'Rope trawling net',
		level: 56,
		constructionLevel: 45,
		maxFishPerCatch: 2,
		sailingXP: 7,
		depths: ['shallow'],
		cost: new Bank({ Rope: 7, 'Teak plank': 4, 'Steel bar': 4, 'Lead bar': 2 })
	},
	{
		id: 'linen_trawling_net',
		name: 'Linen trawling net',
		level: 65,
		constructionLevel: 61,
		maxFishPerCatch: 3,
		sailingXP: 9,
		depths: ['shallow', 'moderate'],
		cost: new Bank({ 'Linen yarn': 6, Rope: 1, 'Mahogany plank': 4, 'Mithril bar': 4, 'Lead bar': 2 })
	},
	{
		id: 'hemp_trawling_net',
		name: 'Hemp trawling net',
		level: 76,
		constructionLevel: 70,
		maxFishPerCatch: 4,
		sailingXP: 11,
		depths: ['shallow', 'moderate', 'deep'],
		cost: new Bank({
			'Hemp yarn': 6,
			Rope: 1,
			'Camphor plank': 4,
			'Adamantite bar': 4,
			'Cupronickel bar': 2,
			'Ray barbs': 4
		})
	},
	{
		id: 'cotton_trawling_net',
		name: 'Cotton trawling net',
		level: 84,
		constructionLevel: 73,
		maxFishPerCatch: 5,
		sailingXP: 15,
		depths: ['shallow', 'moderate', 'deep'],
		cost: new Bank({
			'Cotton yarn': 6,
			Rope: 1,
			'Ironwood plank': 4,
			'Runite bar': 4,
			'Cupronickel bar': 2,
			'Ray barbs': 8
		})
	}
];

export const TrawlingShoals: TrawlingShoal[] = [
	{
		id: 'giant_krill',
		name: 'Giant krill shoal',
		fish: 'Raw giant krill',
		fishingLevel: 69,
		fishingXP: 112.5,
		depth: 'shallow',
		catchChanceLow: 15,
		catchChanceHigh: 30,
		stopDuration: Time.Second * 90
	},
	{
		id: 'haddock',
		name: 'Haddock shoal',
		fish: 'Raw haddock',
		fishingLevel: 73,
		fishingXP: 128.5,
		depth: 'shallow',
		catchChanceLow: 12,
		catchChanceHigh: 28,
		stopDuration: Time.Second * 72
	},
	{
		id: 'yellowfin',
		name: 'Yellowfin shoal',
		fish: 'Raw yellowfin',
		fishingLevel: 79,
		fishingXP: 155.5,
		depth: 'moderate',
		catchChanceLow: 8,
		catchChanceHigh: 27,
		stopDuration: Time.Second * 60
	},
	{
		id: 'halibut',
		name: 'Halibut shoal',
		fish: 'Raw halibut',
		fishingLevel: 83,
		fishingXP: 195.5,
		depth: 'moderate',
		catchChanceLow: 6,
		catchChanceHigh: 25,
		stopDuration: Time.Second * 48
	},
	{
		id: 'bluefin',
		name: 'Bluefin shoal',
		fish: 'Raw bluefin',
		fishingLevel: 87,
		fishingXP: 220.5,
		depth: 'deep',
		catchChanceLow: 5,
		catchChanceHigh: 23,
		stopDuration: Time.Second * 42
	},
	{
		id: 'marlin_shoal',
		name: 'Marlin shoal',
		fish: 'Raw marlin',
		fishingLevel: 91,
		fishingXP: 265.5,
		depth: 'deep',
		catchChanceLow: 4,
		catchChanceHigh: 20,
		stopDuration: Time.Second * 30
	}
];

export const TrawlingNetById = new Map(TrawlingNets.map(net => [net.id, net]));
export const TrawlingShoalById = new Map(TrawlingShoals.map(shoal => [shoal.id, shoal]));

export function isTrawlingNetFacility(facility: SailingFacilityId): facility is TrawlingNetId {
	return TrawlingNetById.has(facility as TrawlingNetId);
}

export function getBestInstalledTrawlingNet(facilities: SailingFacilityId[]): TrawlingNet | undefined {
	return [...TrawlingNets].reverse().find(net => facilities.includes(net.id));
}

export function canTrawlAtDepth(net: TrawlingNet, depth: TrawlingDepth) {
	return net.depths.includes(depth);
}

export function getTrawlingCatchChance(shoal: TrawlingShoal, fishingLevel: number) {
	if (fishingLevel < shoal.fishingLevel) return 0;
	if (fishingLevel >= 99) return shoal.catchChanceHigh;
	const levelProgress = (fishingLevel - shoal.fishingLevel) / (99 - shoal.fishingLevel);
	return shoal.catchChanceLow + (shoal.catchChanceHigh - shoal.catchChanceLow) * levelProgress;
}
