import { MathRNG, type RNGProvider } from '@oldschoolgg/rng';
import { Time } from '@oldschoolgg/toolkit';
import { EItem, toKMB } from 'oldschooljs';

import addSkillingClueToLoot from '@/lib/minions/functions/addSkillingClueToLoot.js';
import type { Fish, SkillNameType } from '@/lib/skilling/types.js';
import type { GearBank } from '@/lib/structures/GearBank.js';
import { UpdateBank } from '@/lib/structures/UpdateBank.js';
import { skillingPetDropRate } from '@/lib/util.js';
import { calcAnglerBoostPercent, calcLeapingExpectedCookingXP, calcMinnowQuantityRange } from './fishingUtil.js';

export function calcFishingTripResult({
	fish,
	duration,
	catches,
	loot,
	gearBank,
	rng,
	blessingExtra = 0,
	flakeExtra = 0,
	usedBarbarianCutEat = false
}: {
	fish: Fish;
	duration: number;
	catches: number[];
	loot: number[];
	gearBank: GearBank;
	rng?: RNGProvider;
	blessingExtra?: number;
	flakeExtra?: number;
	usedBarbarianCutEat?: boolean;
}) {
	const rngProvider = rng ?? MathRNG;

	const updateBank = new UpdateBank();
	const messages: string[] = [];
	const fishingLevel = gearBank.skillsAsLevels.fishing;
	const useBarbarianCutEat = Boolean(usedBarbarianCutEat);
	const isBarbarianFishing = fish.name === 'Barbarian fishing';
	const canCatchSalmon =
		isBarbarianFishing && gearBank.skillsAsLevels.agility >= 30 && gearBank.skillsAsLevels.strength >= 30;
	const canCatchSturgeon =
		isBarbarianFishing && gearBank.skillsAsLevels.agility >= 45 && gearBank.skillsAsLevels.strength >= 45;
	const canHandleSubfish = (id: number) => {
		if (!isBarbarianFishing) {
			return true;
		}
		if (id === EItem.LEAPING_SALMON) {
			return canCatchSalmon;
		}
		if (id === EItem.LEAPING_STURGEON) {
			return canCatchSturgeon;
		}
		return true;
	};

	let fishingXP = 0;
	const bonusXP: Partial<Record<SkillNameType, number>> = {};
	const totalCatches = catches.reduce((total, val) => total + val, 0);

	for (let i = 0; i < fish.subfishes!.length; i++) {
		const subfish = fish.subfishes![i];
		const quantity = catches[i] ?? 0;
		const lootQty = loot[i] ?? 0;

		if (quantity === 0 && lootQty === 0) continue;
		if (!canHandleSubfish(subfish.id)) continue;

		fishingXP += quantity * subfish.xp;
		updateBank.itemLootBank.add(subfish.id, lootQty);

		if (subfish.bonusXP) {
			for (const [skillName, xpPerCatch] of Object.entries(subfish.bonusXP) as [SkillNameType, number][]) {
				if (skillName === 'cooking' && !useBarbarianCutEat) {
					continue;
				}
				if (
					isBarbarianFishing &&
					(skillName === 'agility' || skillName === 'strength') &&
					!canHandleSubfish(subfish.id)
				) {
					continue;
				}

				let xpToAdd = quantity * xpPerCatch;

				if (skillName === 'cooking') {
					xpToAdd = calcLeapingExpectedCookingXP({
						id: subfish.id,
						quantity,
						cookingLevel: gearBank.skillsAsLevels.cooking,
						xpPerSuccess: xpPerCatch,
						rng: rngProvider
					});
				}

				bonusXP[skillName] = (bonusXP[skillName] ?? 0) + xpToAdd;
			}
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
	for (const [skillName, xp] of Object.entries(bonusXP) as [SkillNameType, number][]) {
		if (xp > 0) {
			updateBank.xpBank.add(skillName, xp, { duration });
		}
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
	const bonusXpPerHour: Partial<Record<SkillNameType, string>> = {};
	if (duration > 0) {
		for (const [skillName, xp] of Object.entries(bonusXP) as [SkillNameType, number][]) {
			const perHour = Math.floor((xp * Time.Hour) / duration);
			if (perHour > 0) {
				bonusXpPerHour[skillName] = toKMB(perHour);
			}
		}
	}

	return {
		updateBank,
		totalCatches,
		messages,
		xpPerHour: toKMB(xpPerHour),
		bonusXpPerHour,
		blessingExtra,
		flakeExtra
	};
}
