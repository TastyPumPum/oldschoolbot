import { Bank } from 'oldschooljs';

import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';

export type ShipPart = 'hull' | 'sails' | 'crew' | 'navigation' | 'cargo';

export const SHIP_PARTS: ShipPart[] = ['hull', 'sails', 'crew', 'navigation', 'cargo'];

export const MAX_SHIP_TIER = 5;

export const SAIL_TIER_TRIM_DATA = [
	{ level: 1, xp: 10.5 },
	{ level: 24, xp: 19.5 },
	{ level: 36, xp: 30 },
	{ level: 52, xp: 48 },
	{ level: 68, xp: 64 }
] as const;

export function getSailTierTrimData(tier: number) {
	return SAIL_TIER_TRIM_DATA[Math.max(0, Math.min(SAIL_TIER_TRIM_DATA.length - 1, tier - 1))];
}

export function calculatePassiveSailingActions({
	duration,
	sailsTier,
	sailingLevel,
	facilities
}: {
	duration: number;
	sailsTier: number;
	sailingLevel: number;
	facilities: SailingFacilityId[];
}) {
	const trimData = getSailTierTrimData(sailsTier);
	const trims = sailingLevel >= trimData.level ? Math.floor(duration / 30_000) : 0;
	const catcher = facilities.includes('gale_catcher')
		? 'gale_catcher'
		: facilities.includes('wind_catcher')
			? 'wind_catcher'
			: null;
	const trimXP = trims * trimData.xp * (catcher ? 0.75 : 1);
	const trimMoteXP = catcher ? trims * (catcher === 'gale_catcher' ? 70 : 40) : 0;
	const extractorHarvests = facilities.includes('crystal_extractor') ? Math.floor(duration / 63_000) : 0;
	const extractorXP = extractorHarvests * 250;
	const extractorMoteXP = catcher ? extractorHarvests * 10 : 0;

	return {
		trims,
		trimXP,
		trimMoteXP,
		extractorHarvests,
		extractorXP,
		extractorMoteXP,
		totalXP: trimXP + trimMoteXP + extractorXP + extractorMoteXP
	};
}

const baseCosts: Record<ShipPart, Array<Bank>> = {
	hull: [
		new Bank({ Plank: 20, 'Iron nails': 50, Rope: 2 }),
		new Bank({ 'Oak plank': 30, 'Steel nails': 80, Rope: 3 }),
		new Bank({ 'Teak plank': 40, 'Mithril nails': 120, Rope: 4 }),
		new Bank({ 'Mahogany plank': 50, 'Adamantite nails': 160, Rope: 6 })
	],
	sails: [
		new Bank({ 'Bolt of cloth': 12, Rope: 4, 'Swamp tar': 20 }),
		new Bank({ 'Bolt of cloth': 20, Rope: 6, 'Swamp tar': 40 }),
		new Bank({ 'Bolt of cloth': 28, Rope: 8, 'Swamp tar': 60 }),
		new Bank({ 'Bolt of cloth': 36, Rope: 10, 'Swamp tar': 80 })
	],
	crew: [
		new Bank({ Coins: 10_000, 'Jug of wine': 5, 'Cooked chicken': 10 }),
		new Bank({ Coins: 25_000, 'Jug of wine': 10, 'Cooked chicken': 20 }),
		new Bank({ Coins: 50_000, 'Jug of wine': 15, 'Cooked chicken': 30 }),
		new Bank({ Coins: 100_000, 'Jug of wine': 20, 'Cooked chicken': 40 })
	],
	navigation: [
		new Bank({ 'Uncut sapphire': 2, 'Uncut emerald': 1, Compass: 1 }),
		new Bank({ 'Uncut emerald': 2, 'Uncut ruby': 1, Compass: 1 }),
		new Bank({ 'Uncut ruby': 2, 'Uncut diamond': 1, Compass: 1 }),
		new Bank({ 'Uncut diamond': 2, Dragonstone: 1, Compass: 1 })
	],
	cargo: [
		new Bank({ 'Oak plank': 20, 'Iron nails': 60 }),
		new Bank({ 'Teak plank': 30, 'Steel nails': 90 }),
		new Bank({ 'Mahogany plank': 40, 'Mithril nails': 120 }),
		new Bank({ 'Mahogany plank': 50, 'Adamantite nails': 160 })
	]
};

export function getShipUpgradeCost(part: ShipPart, fromTier: number, toTier: number): Bank {
	const cost = new Bank();
	const safeFrom = Math.max(1, fromTier);
	const safeTo = Math.min(MAX_SHIP_TIER, toTier);
	for (let nextTier = safeFrom + 1; nextTier <= safeTo; nextTier++) {
		const tierCost = baseCosts[part][nextTier - 2];
		if (tierCost) cost.add(tierCost);
	}
	return cost;
}
