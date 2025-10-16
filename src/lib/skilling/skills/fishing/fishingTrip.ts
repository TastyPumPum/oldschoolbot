import { MathRNG, type RNGProvider } from '@oldschoolgg/rng';
import { Time } from '@oldschoolgg/toolkit';
import { EItem, toKMB } from 'oldschooljs';

import addSkillingClueToLoot from '@/lib/minions/functions/addSkillingClueToLoot.js';
import type { Fish } from '@/lib/skilling/types.js';
import type { GearBank } from '@/lib/structures/GearBank.js';
import { UpdateBank } from '@/lib/structures/UpdateBank.js';
import { skillingPetDropRate } from '@/lib/util.js';
import { calcAnglerBoostPercent, calcMinnowQuantityRange } from './fishingUtil.js';

export function calcFishingTripResult({
	fish,
	duration,
	catches,
	loot,
	gearBank,
	rng,
	blessingExtra = 0,
	flakeExtra = 0
}: {
	fish: Fish;
	duration: number;
	catches: number[];
	loot: number[];
	gearBank: GearBank;
	rng?: RNGProvider;
	blessingExtra?: number;
	flakeExtra?: number;
}) {
	const rngProvider = rng ?? MathRNG;

	const updateBank = new UpdateBank();
	const messages: string[] = [];
	const fishingLevel = gearBank.skillsAsLevels.fishing;

	let fishingXP = 0;
	let otherXP = 0;
	const totalCatches = catches.reduce((total, val) => total + val, 0);

	for (let i = 0; i < fish.subfishes!.length; i++) {
		const subfish = fish.subfishes![i];
		const quantity = catches[i] ?? 0;
		const lootQty = loot[i] ?? 0;

		if (quantity === 0 && lootQty === 0) continue;

		fishingXP += quantity * subfish.xp;
		updateBank.itemLootBank.add(subfish.id, lootQty);

		if (subfish.otherXP) {
			otherXP += quantity * subfish.otherXP;
		}

		if (subfish.tertiary) {
			for (let j = 0; j < quantity; j++) {
				if (rngProvider.roll(subfish.tertiary.chance)) {
					updateBank.itemLootBank.add(subfish.tertiary.id);
				}
			}
		}
	}

	const anglerBoost = calcAnglerBoostPercent(gearBank);
	if (anglerBoost > 0) {
		const bonusXP = (fishingXP * anglerBoost) / 100;
		fishingXP += bonusXP;
		messages.push(`**Bonus XP:** ${bonusXP.toFixed(1)} (+${anglerBoost.toFixed(1)}%) XP for angler`);
	}

	if (blessingExtra > 0) {
		messages.push(`Rada's blessing granted ${blessingExtra.toLocaleString()} extra fish`);
	}

	if (flakeExtra > 0) {
		messages.push(`Spirit flakes granted ${flakeExtra.toLocaleString()} extra fish`);
	}

	updateBank.xpBank.add('fishing', fishingXP, { duration });
	if (otherXP > 0) {
		updateBank.xpBank.add('agility', otherXP, { duration });
		updateBank.xpBank.add('strength', otherXP, { duration });
	}

	if (fish.name === 'Minnow') {
		const [min, max] = calcMinnowQuantityRange(gearBank);
		const catchCount = updateBank.itemLootBank.amount(EItem.MINNOW);
		let totalMinnows = 0;
		for (let i = 0; i < catchCount; i++) {
			totalMinnows += rngProvider.randInt(min, max);
		}
		updateBank.itemLootBank.set(EItem.MINNOW, totalMinnows);
	} else if (fish.name === 'Karambwanji') {
		const baseKarambwanji = 1 + Math.floor(fishingLevel / 5);
		const qty = updateBank.itemLootBank.amount(EItem.RAW_KARAMBWANJI);
		if (qty > 0) {
			updateBank.itemLootBank.set(EItem.RAW_KARAMBWANJI, qty * baseKarambwanji);
		}
	}

	if (fish.clueScrollChance) {
		addSkillingClueToLoot(gearBank, 'fishing', totalCatches, fish.clueScrollChance, updateBank.itemLootBank);
	}

	if (fish.petChance) {
		const { petDropRate } = skillingPetDropRate(gearBank, 'fishing', fish.petChance);
		for (let i = 0; i < totalCatches; i++) {
			if (rngProvider.roll(petDropRate)) {
				updateBank.itemLootBank.add('Heron');
			}
		}
	}

	const xpPerHour = duration === 0 ? 0 : Math.floor((fishingXP * Time.Hour) / duration);
	const otherXpPerHour = duration === 0 ? 0 : Math.floor((otherXP * Time.Hour) / duration);

	return {
		updateBank,
		totalCatches,
		messages,
		xpPerHour: toKMB(xpPerHour),
		otherXpPerHour: toKMB(otherXpPerHour),
		blessingExtra,
		flakeExtra
	};
}
