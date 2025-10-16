import { Time } from '@oldschoolgg/toolkit';
import { Bank, EItem, Items } from 'oldschooljs';

import type { Fish } from '@/lib/skilling/types.js';
import type { GearBank } from '@/lib/structures/GearBank.js';
import { calcRadasBlessingBoost } from './fishingUtil.js';

const harpoonBoosts = [
	{ id: EItem.CRYSTAL_HARPOON, boostPercent: 35 },
	{ id: EItem.DRAGON_HARPOON, boostPercent: 20 },
	{ id: EItem.INFERNAL_HARPOON, boostPercent: 20 }
];

const harpoonFishSpots = new Set(['Tuna/Swordfish', 'Shark']);

function isHarpoonFishSpot(fish: Fish) {
	return harpoonFishSpots.has(fish.name);
}

function rollExtraLoot({
	lootAmount,
	flakesUsed,
	currentInv,
	blessingChance,
	spiritFlakes,
	flakesAvailable
}: {
	lootAmount: number;
	flakesUsed: number;
	currentInv: number;
	blessingChance: number;
	spiritFlakes: boolean;
	flakesAvailable: number;
}) {
	let updatedLoot = lootAmount + 1;
	let updatedFlakesUsed = flakesUsed;
	let updatedInv = currentInv + 1;

	if (Math.random() < blessingChance / 100) {
		updatedLoot += 1;
		updatedInv += 1;
	}

	if (spiritFlakes && updatedFlakesUsed < flakesAvailable && Math.random() < 0.5) {
		updatedLoot += 1;
		updatedFlakesUsed += 1;
		updatedInv += 1;
	}

	return {
		loot: updatedLoot,
		flakesUsed: updatedFlakesUsed,
		inv: updatedInv
	};
}

function determineFishingTime({
	quantity,
	tripTicks,
	isPowerfishing,
	isUsingSpiritFlakes,
	fish,
	gearBank,
	invSlots,
	blessingChance,
	flakesAvailable,
	harpoonBoost,
	hasWildyEliteDiary
}: {
	quantity: number;
	tripTicks: number;
	isPowerfishing: boolean;
	isUsingSpiritFlakes: boolean;
	fish: Fish;
	gearBank: GearBank;
	invSlots: number;
	blessingChance: number;
	flakesAvailable: number;
	harpoonBoost: number;
	hasWildyEliteDiary: boolean;
}) {
	let ticksElapsed = 0;
	let flakesUsed = 0;
	let currentInv = 0;

	const fishCount = fish.subfishes!.length;
	const catches = new Array<number>(fishCount).fill(0);
	const loot = new Array<number>(fishCount).fill(0);

	const fishingLevel = gearBank.skillsAsLevels.fishing;
	let effectiveFishingLevel = fishingLevel;

	if (fishingLevel > 68) {
		if (['Shark', 'Mackerel/Cod/Bass', 'Lobster'].includes(fish.name)) {
			effectiveFishingLevel += 7;
		} else if (fish.name === 'Tuna/Swordfish' && !isPowerfishing) {
			effectiveFishingLevel += 7;
		}
	}

	const probabilities = fish.subfishes!.map(
		subfish => harpoonBoost * (subfish.intercept + (effectiveFishingLevel - 1) * subfish.slope)
	);

	if (fish.name === 'Dark crab' && hasWildyEliteDiary) {
		const adjustedIntercept = 0.0961;
		const adjustedSlope = 0.0025;
		probabilities[0] = harpoonBoost * (adjustedIntercept + (effectiveFishingLevel - 1) * adjustedSlope);
	}

	let ticksPerRoll = fish.ticksPerRoll!;
	let lostTicks = fish.lostTicks!;
	let bankingTime = fish.bankingTime ?? 0;

	if (fish.name === 'Barbarian fishing') {
		if (isPowerfishing) {
			ticksPerRoll = 3;
			lostTicks = 0.06;
		}
		if (gearBank.hasEquippedOrInBank(['Fishing cape', 'Fishing cape (t)', 'Max cape'])) {
			bankingTime = 20;
		}
	} else if (fish.name === 'Trout/Salmon' && isPowerfishing) {
		ticksPerRoll = 3;
		lostTicks = 0.06;
	} else if (fish.name === 'Tuna/Swordfish' && isPowerfishing) {
		ticksPerRoll = 2;
		lostTicks = 0.05;
	}

	const totalRequired = quantity;

	if (isPowerfishing) {
		while (ticksElapsed < tripTicks) {
			for (let i = fishCount - 1; i >= 0; i--) {
				const subfish = fish.subfishes![i];
				if (fishingLevel < subfish.level) continue;
				if (Math.random() < probabilities[i]) {
					catches[i]++;
					break;
				}
			}

			ticksElapsed += ticksPerRoll * (1 + lostTicks);

			if (catches.reduce((total, val) => total + val, 0) >= totalRequired) {
				break;
			}
		}
	} else {
		while (ticksElapsed < tripTicks) {
			for (let i = fishCount - 1; i >= 0; i--) {
				const subfish = fish.subfishes![i];
				if (fishingLevel < subfish.level) continue;
				if (Math.random() < probabilities[i]) {
					catches[i]++;
					const result = rollExtraLoot({
						lootAmount: loot[i],
						flakesUsed,
						currentInv,
						blessingChance,
						spiritFlakes: isUsingSpiritFlakes,
						flakesAvailable
					});
					loot[i] = result.loot;
					flakesUsed = result.flakesUsed;
					currentInv = result.inv;
					break;
				}
			}

			ticksElapsed += ticksPerRoll * (1 + lostTicks);

			if (catches.reduce((total, val) => total + val, 0) >= totalRequired) {
				break;
			}

			if (currentInv >= invSlots) {
				ticksElapsed += bankingTime;
				currentInv = 0;
			}
		}
	}

	return {
		catches,
		loot,
		ticksElapsed,
		flakesUsed
	};
}

export function calcFishingTripStart({
	gearBank,
	fish,
	maxTripLength,
	quantityInput,
	wantsToUseFlakes,
	powerfish,
	hasWildyEliteDiary
}: {
	gearBank: GearBank;
	fish: Fish;
	maxTripLength: number;
	quantityInput: number | undefined;
	wantsToUseFlakes: boolean;
	powerfish: boolean;
	hasWildyEliteDiary: boolean;
}) {
	if (!fish.subfishes || fish.subfishes.length === 0) {
		return 'This fishing spot is not yet supported.';
	}

	let quantity = quantityInput ?? 3000;
	let isUsingSpiritFlakes = wantsToUseFlakes;
	let isPowerfishing = powerfish;

	if (['Minnow', 'Karambwanji'].includes(fish.name)) {
		isPowerfishing = false;
	}
	if (isPowerfishing) {
		isUsingSpiritFlakes = false;
	}

	const boosts: string[] = [];
	if (isPowerfishing) {
		boosts.push('**Powerfishing**');
	}

	let harpoonBoost = 1;
	if (isHarpoonFishSpot(fish)) {
		for (const { id, boostPercent } of harpoonBoosts) {
			if (gearBank.hasEquipped(id)) {
				harpoonBoost = 1 + boostPercent / 100;
				boosts.push(`+${boostPercent}% for ${Items.itemNameFromId(id)}`);
				break;
			}
		}
	}

	if (fish.name === 'Dark crab' && hasWildyEliteDiary) {
		boosts.push('Increased dark crab catch rate from Elite Wilderness Diary');
	}

	if (isUsingSpiritFlakes) {
		if (!gearBank.bank.has('Spirit flakes')) {
			return 'You need to have at least one Spirit flake!';
		}
		boosts.push('50% more fish from using spirit flakes');
	}

	const { blessingEquipped, blessingChance } = calcRadasBlessingBoost(gearBank);
	if (blessingEquipped && !isPowerfishing) {
		boosts.push(`Your Rada's Blessing gives ${blessingChance}% chance of extra fish`);
	}

	let invSlots = 26;
	const hasFishBarrel = gearBank.hasEquippedOrInBank(['Fish sack barrel', 'Fish barrel']);
	if (hasFishBarrel) {
		invSlots += 28;
	}

	let maxTrip = maxTripLength;
	if (!isPowerfishing && hasFishBarrel && fish.name !== 'Minnow') {
		maxTrip += Time.Minute * 9;
		boosts.push('+9 minutes for Fish barrel');
	}

	const tripTicks = maxTrip / (Time.Second * 0.6);
	const flakesAvailable = gearBank.bank.amount('Spirit flakes');

	if (fish.bait) {
		const baseCost = new Bank().add(fish.bait);
		const maxCanDo = gearBank.bank.fits(baseCost);
		if (maxCanDo === 0) {
			return `You need ${Items.itemNameFromId(fish.bait)} to fish ${fish.name}!`;
		}
		quantity = Math.min(quantity, maxCanDo);
	}

	const { catches, loot, ticksElapsed, flakesUsed } = determineFishingTime({
		quantity,
		tripTicks,
		isPowerfishing,
		isUsingSpiritFlakes,
		fish,
		gearBank,
		invSlots,
		blessingChance,
		flakesAvailable,
		harpoonBoost,
		hasWildyEliteDiary
	});

	const totalCaught = catches.reduce((total, val) => total + val, 0);
	if (totalCaught === 0) {
		return `You can't fish any ${fish.name}. Try a higher quantity or ensure you have the required supplies.`;
	}

	const duration = Time.Second * 0.6 * ticksElapsed;

	return {
		duration,
		quantity: totalCaught,
		flakesBeingUsed: !isPowerfishing ? flakesUsed : undefined,
		boosts,
		fish,
		catches,
		loot,
		isPowerfishing,
		isUsingSpiritFlakes: isUsingSpiritFlakes && flakesUsed > 0
	};
}
