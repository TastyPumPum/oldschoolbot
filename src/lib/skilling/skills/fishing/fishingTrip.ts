import type { RNGProvider } from '@oldschoolgg/rng';
import { calcPercentOfNum } from '@oldschoolgg/toolkit';
import { EItem } from 'oldschooljs';

import addSkillingClueToLoot from '@/lib/minions/functions/addSkillingClueToLoot.js';
import type { Fish } from '@/lib/skilling/types.js';
import type { GearBank } from '@/lib/structures/GearBank.js';
import { UpdateBank } from '@/lib/structures/UpdateBank.js';
import { skillingPetDropRate } from '@/lib/util.js';
import { calcAnglerBoostPercent, calcMinnowQuantityRange } from './fishingUtil.js';

export interface FishingTripResultOptions {
	fish: Fish;
	catches: number[];
	loot: number[];
	duration: number;
	gearBank: GearBank;
	rng: RNGProvider;
	flakesToRemove?: number;
	powerfishing: boolean;
}

export interface FishingTripResult {
	updateBank: UpdateBank;
	boosts: string[];
	totalCatches: number;
}

export function calcFishingTripResult({
	fish,
	catches,
	loot,
	duration,
	gearBank,
	rng,
	flakesToRemove,
	powerfishing
}: FishingTripResultOptions): FishingTripResult {
	const updateBank = new UpdateBank();
	const boosts: string[] = [];

	const totalCatches = catches.reduce((acc, curr) => acc + curr, 0);

	let fishingXP = 0;
	let auxiliaryXP = 0;

	if (fish.subfishes) {
		fish.subfishes.forEach((subfish, index) => {
			const caughtQty = catches[index] ?? 0;
			if (caughtQty === 0) return;

			fishingXP += caughtQty * subfish.xp;
			if (subfish.otherXP) {
				auxiliaryXP += caughtQty * subfish.otherXP;
			}

			const lootQty = loot[index] ?? 0;
			if (!powerfishing && lootQty > 0) {
				updateBank.itemLootBank.add(subfish.id, lootQty);
			}

			if (subfish.tertiary) {
				for (let i = 0; i < caughtQty; i++) {
					if (rng.roll(subfish.tertiary.chance)) {
						updateBank.itemLootBank.add(subfish.tertiary.id);
					}
				}
			}
		});
	} else {
		const caughtQty = catches[0] ?? 0;
		fishingXP += caughtQty * (fish.xp ?? 0);
		const lootQty = loot[0] ?? 0;
		if (!powerfishing && lootQty > 0 && fish.id) {
			updateBank.itemLootBank.add(fish.id, lootQty);
		}

		if (fish.bigFishRate && fish.bigFish) {
			for (let i = 0; i < caughtQty; i++) {
				if (rng.roll(fish.bigFishRate)) {
					updateBank.itemLootBank.add(fish.bigFish);
				}
			}
		}
	}

	const anglerBoost = calcAnglerBoostPercent(gearBank);
	if (anglerBoost > 0) {
		const anglerXP = Math.ceil(calcPercentOfNum(anglerBoost, fishingXP));
		boosts.push(`${anglerBoost.toFixed(1)}% (${anglerXP.toLocaleString()} XP) from Angler outfit`);
		fishingXP += anglerXP;
	}

	updateBank.xpBank.add('fishing', fishingXP, { duration });
	if (fish.name === 'Barbarian fishing' && auxiliaryXP > 0) {
		updateBank.xpBank.add('agility', auxiliaryXP, { duration });
		updateBank.xpBank.add('strength', auxiliaryXP, { duration });
	}

	if (!powerfishing) {
		if (fish.name === 'Karambwanji') {
			const base = 1 + Math.floor(gearBank.skillsAsLevels.fishing / 5);
			const current = updateBank.itemLootBank.amount(EItem.RAW_KARAMBWANJI);
			updateBank.itemLootBank.set(EItem.RAW_KARAMBWANJI, current * base);
		} else if (fish.name === 'Minnow') {
			const range = calcMinnowQuantityRange(gearBank);
			const current = updateBank.itemLootBank.amount(EItem.MINNOW);
			let total = 0;
			for (let i = 0; i < current; i++) {
				total += rng.randInt(range[0], range[1]);
			}
			updateBank.itemLootBank.set(EItem.MINNOW, total);
		}
	}

	if (fish.clueScrollChance) {
		addSkillingClueToLoot(gearBank, 'fishing', totalCatches, fish.clueScrollChance, updateBank.itemLootBank);
	}

	if (fish.petChance) {
		const { petDropRate } = skillingPetDropRate(gearBank, 'fishing', fish.petChance);
		for (let i = 0; i < totalCatches; i++) {
			if (rng.roll(petDropRate)) {
				updateBank.itemLootBank.add('Heron');
			}
		}
	}

	if (!powerfishing && flakesToRemove) {
		updateBank.itemCostBank.add('Spirit flakes', flakesToRemove);
	}

	return {
		updateBank,
		boosts,
		totalCatches
	};
}
