import { round } from '@oldschoolgg/toolkit';
import { EItem, itemID } from 'oldschooljs';

import type { GearBank } from '@/lib/structures/GearBank.js';

const anglerItemsArr = [
	{
		id: EItem.ANGLER_HAT,
		boost: 0.4
	},
	{
		id: EItem.ANGLER_TOP,
		boost: 0.8
	},
	{
		id: EItem.ANGLER_WADERS,
		boost: 0.6
	},
	{
		id: EItem.ANGLER_BOOTS,
		boost: 0.2
	}
] as const;

const anglerItems = anglerItemsArr.map(item => [item.id, item.boost] as const);

function calcRadasBlessingBoost(gearBank: GearBank) {
	const blessingBoosts = [
		["Rada's blessing 4", 8],
		["Rada's blessing 3", 6],
		["Rada's blessing 2", 4],
		["Rada's blessing 1", 2]
	];

	for (const [itemName, boostPercent] of blessingBoosts) {
		if (gearBank.hasEquipped(itemName)) {
			return { blessingEquipped: true, blessingChance: boostPercent as number };
		}
	}
	return { blessingEquipped: false, blessingChance: 0 };
}

const minnowQuantity: { [key: number]: [number, number] } = {
	99: [10, 14],
	95: [11, 13],
	90: [10, 13],
	85: [10, 11],
	1: [10, 10]
};

function calcMinnowQuantityRange(gearBank: GearBank): [number, number] {
	for (const [level, quantities] of Object.entries(minnowQuantity).reverse()) {
		if (gearBank.skillsAsLevels.fishing >= Number.parseInt(level)) {
			return quantities;
		}
	}
	return [10, 10];
}

function calcAnglerBoostPercent(gearBank: GearBank) {
	const equippedPieces = anglerItemsArr.filter(item => gearBank.hasEquipped(item.id));
	if (equippedPieces.length === anglerItemsArr.length) {
		return 2.5;
	}
	const boostPercent = equippedPieces.reduce((total, item) => total + item.boost, 0);
	return round(boostPercent, 1);
}

export { calcRadasBlessingBoost, calcMinnowQuantityRange, calcAnglerBoostPercent, anglerItems, anglerItemsArr };
