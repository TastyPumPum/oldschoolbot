import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank, EItem, Items } from 'oldschooljs';

import type { Fish } from '@/lib/skilling/types.js';
import type { GearBank } from '@/lib/structures/GearBank.js';
import { calcRadasBlessingBoost } from './fishingUtil.js';

const TICK_DURATION = Time.Second * 0.6;
const STACKABLE_FISHING_SPOTS = new Set(['Minnow', 'Karambwanji']);

const HARPOON_BOOSTS = [
	{ id: EItem.CRYSTAL_HARPOON, boostPercent: 35 },
	{ id: EItem.DRAGON_HARPOON, boostPercent: 20 },
	{ id: EItem.INFERNAL_HARPOON, boostPercent: 20 }
];

interface DetermineFishingTimeArgs {
	quantity: number;
	tripTicks: number;
	isPowerfishing: boolean;
	isUsingSpiritFlakes: boolean;
	fish: Fish;
	gearBank: GearBank;
	invSlots: number;
	blessingChance: number;
	flakesQuantity: number;
	harpoonBoost: number;
	hasWildyEliteDiary: boolean;
}

interface DetermineFishingTimeResult {
	catches: number[];
	lootAmount: number[];
	ticksElapsed: number;
	flakesUsed: number;
}

interface LegacyTripResult {
	cost: Bank;
	duration: number;
	quantity: number;
	boosts: string[];
	flakesBeingUsed?: number;
	catches: number[];
	loot: number[];
	flakesToRemove?: number;
	powerfishing: boolean;
	spiritFlakes: boolean;
}

function isHarpoonFishSpot(fish: Fish) {
	return fish.name === 'Tuna/Swordfish' || fish.name === 'Shark';
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
	flakesQuantity,
	harpoonBoost,
	hasWildyEliteDiary
}: DetermineFishingTimeArgs): DetermineFishingTimeResult {
	const subfishes = fish.subfishes!;
	const catches = new Array(subfishes.length).fill(0);
	const lootAmount = new Array(subfishes.length).fill(0);

	let ticksElapsed = 0;
	let flakesUsed = 0;
	let currentInv = 0;

	const fishingLevel = gearBank.skillsAsLevels.fishing;
	let effectiveFishingLevel = fishingLevel;

	if (fishingLevel >= 68) {
		if (fish.name === 'Shark' || fish.name === 'Mackerel/Cod/Bass' || fish.name === 'Lobster') {
			effectiveFishingLevel += 7;
		} else if (fish.name === 'Tuna/Swordfish' && !isPowerfishing) {
			effectiveFishingLevel += 7;
		}
	}

	const probabilities = subfishes.map(subfish => {
		const base = harpoonBoost * (subfish.intercept + (effectiveFishingLevel - 1) * subfish.slope);
		return Math.min(1, Math.max(0, base));
	});

	if (fish.name === 'Dark crab' && hasWildyEliteDiary) {
		const adjustedIntercept = 0.0961;
		const adjustedSlope = 0.0025;
		probabilities[0] = Math.min(
			1,
			Math.max(0, harpoonBoost * (adjustedIntercept + (effectiveFishingLevel - 1) * adjustedSlope))
		);
	}

	let ticksPerRoll = fish.ticksPerRoll ?? 5;
	let lostTicks = fish.lostTicks ?? 0;
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

	while (ticksElapsed < tripTicks) {
		for (let i = subfishes.length - 1; i >= 0; i--) {
			if (fishingLevel < subfishes[i].level) continue;
			if (Math.random() > probabilities[i]) continue;

			catches[i]++;
			if (!isPowerfishing) {
				lootAmount[i]++;
				currentInv++;

				if (blessingChance > 0 && Math.random() < blessingChance / 100) {
					lootAmount[i]++;
					currentInv++;
				}
				if (isUsingSpiritFlakes && flakesUsed < flakesQuantity && Math.random() < 0.5) {
					lootAmount[i]++;
					flakesUsed++;
					currentInv++;
				}
			}
			break;
		}

		ticksElapsed += ticksPerRoll * (1 + lostTicks);

		const totalCaught = catches.reduce((acc, curr) => acc + curr, 0);
		if (totalCaught >= quantity) {
			break;
		}

		if (!isPowerfishing && !STACKABLE_FISHING_SPOTS.has(fish.name) && currentInv >= invSlots) {
			ticksElapsed += bankingTime;
			currentInv = 0;
		}

		if (ticksElapsed >= tripTicks) {
			break;
		}
	}

	return {
		catches,
		lootAmount,
		ticksElapsed,
		flakesUsed
	};
}

function legacyTripStart({
	gearBank,
	fish,
	maxTripLength,
	quantityInput,
	wantsToUseFlakes
}: {
	gearBank: GearBank;
	fish: Fish;
	maxTripLength: number;
	quantityInput: number | undefined;
	wantsToUseFlakes: boolean;
}): LegacyTripResult | string {
	const boosts: string[] = [];
	const fishingLevel = gearBank.skillsAsLevels.fishing;
	const timePerFish = fish.timePerFish ?? 0;
	let scaledTimePerFish = Time.Second * timePerFish * (1 + (100 - fishingLevel) / 100);

	switch (fish.bait) {
		case EItem.FISHING_BAIT:
			if (fish.name === 'Infernal eel') {
				break;
			}
			if (gearBank.hasEquippedOrInBank('Pearl fishing rod')) {
				scaledTimePerFish *= 0.95;
				boosts.push('5% for Pearl fishing rod');
			}
			break;
		case EItem.FEATHER:
			if (fish.name === 'Barbarian fishing' && gearBank.hasEquippedOrInBank('Pearl barbarian rod')) {
				scaledTimePerFish *= 0.95;
				boosts.push('5% for Pearl barbarian rod');
			} else if (gearBank.hasEquippedOrInBank('Pearl fly fishing rod')) {
				scaledTimePerFish *= 0.95;
				boosts.push('5% for Pearl fly fishing rod');
			}
			break;
		default:
			if (gearBank.hasEquippedOrInBank('Crystal harpoon')) {
				scaledTimePerFish *= 0.95;
				boosts.push('5% for Crystal harpoon');
			}
			break;
	}

	if (fish.id === EItem.MINNOW) {
		scaledTimePerFish *= Math.max(0.83, -0.000_541_351 * fishingLevel ** 2 + 0.089_066_3 * fishingLevel - 2.681_53);
	}

	if (gearBank.hasEquippedOrInBank(['Fish sack barrel', 'Fish barrel'])) {
		boosts.push('+9 trip minutes for Fish barrel');
	}

	let quantity = quantityInput ?? Math.floor(maxTripLength / scaledTimePerFish);

	if (fish.bait) {
		const baseCost = new Bank().add(fish.bait);
		const maxCanDo = gearBank.bank.fits(baseCost);
		if (maxCanDo === 0) {
			return `You need ${Items.itemNameFromId(fish.bait)} to fish ${fish.name}!`;
		}
		if (maxCanDo < quantity) {
			quantity = maxCanDo;
		}
	}

	if (quantity === 0) {
		return `You can't fish any ${fish.name}. Try a higher quantity or ensure you have the required supplies.`;
	}

	const duration = quantity * scaledTimePerFish;
	if (duration > maxTripLength) {
		const highestAmount = Math.floor(maxTripLength / scaledTimePerFish);
		return `${gearBank.minionName} can't go on trips longer than ${formatDuration(maxTripLength)}, try a lower quantity. The highest amount of ${
			fish.name
		} you can fish is ${highestAmount}.`;
	}

	let flakesBeingUsed: number | undefined;
	if (wantsToUseFlakes) {
		if (!gearBank.bank.has('Spirit flakes')) {
			return 'You need to have at least one Spirit flake!';
		}
		flakesBeingUsed = Math.min(gearBank.bank.amount('Spirit flakes'), quantity);
		if (flakesBeingUsed > 0) {
			boosts.push(`More fish from using ${flakesBeingUsed}x Spirit flakes`);
		}
	}

	const cost = new Bank();
	if (fish.bait) {
		cost.add(fish.bait, quantity);
	}
	if (flakesBeingUsed) {
		cost.add('Spirit flakes', flakesBeingUsed);
	}

	return {
		cost,
		duration,
		quantity,
		boosts,
		flakesBeingUsed,
		catches: [quantity],
		loot: [quantity],
		flakesToRemove: flakesBeingUsed,
		powerfishing: false,
		spiritFlakes: Boolean(flakesBeingUsed)
	};
}

export function calcFishingTripStart({
	gearBank,
	fish,
	maxTripLength,
	quantityInput,
	wantsToUseFlakes,
	powerfishing = false,
	hasWildyEliteDiary = false
}: {
	gearBank: GearBank;
	fish: Fish;
	maxTripLength: number;
	quantityInput: number | undefined;
	wantsToUseFlakes: boolean;
	powerfishing?: boolean;
	hasWildyEliteDiary?: boolean;
}) {
	if (!fish.subfishes) {
		return legacyTripStart({ gearBank, fish, maxTripLength, quantityInput, wantsToUseFlakes });
	}

	let isPowerfishing = Boolean(powerfishing);
	let isUsingSpiritFlakes = Boolean(wantsToUseFlakes);

	if (STACKABLE_FISHING_SPOTS.has(fish.name)) {
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
		for (const { id, boostPercent } of HARPOON_BOOSTS) {
			if (!gearBank.hasEquipped(id)) continue;
			harpoonBoost = 1 + boostPercent / 100;
			boosts.push(`+${boostPercent}% for ${Items.itemNameFromId(id)}`);
			break;
		}
	}

	if (fish.name === 'Dark crab' && hasWildyEliteDiary) {
		boosts.push('Increased dark crab catch rate from the Elite Wilderness Diary');
	}

	if (isUsingSpiritFlakes) {
		if (!gearBank.bank.has('Spirit flakes')) {
			return 'You need to have at least one spirit flake!';
		}
		boosts.push('50% more fish from using spirit flakes');
	}

	const { blessingEquipped, blessingChance } = calcRadasBlessingBoost(gearBank);
	if (blessingEquipped && !isPowerfishing) {
		boosts.push(`Rada's Blessing: ${blessingChance}% chance of extra fish`);
	}

	let invSlots = 26;
	const hasBarrel = gearBank.hasEquippedOrInBank(['Fish sack barrel', 'Fish barrel']);
	if (!isPowerfishing && !STACKABLE_FISHING_SPOTS.has(fish.name) && hasBarrel) {
		invSlots += 28;
	}

	let effectiveMaxTrip = maxTripLength;
	if (!isPowerfishing && !STACKABLE_FISHING_SPOTS.has(fish.name) && hasBarrel) {
		effectiveMaxTrip += Time.Minute * 9;
		boosts.push('+9 trip minutes for Fish barrel');
	}

	const tripTicks = effectiveMaxTrip / TICK_DURATION;
	let quantity = quantityInput ?? 50_000;

	if (fish.bait) {
		const baseCost = new Bank().add(fish.bait);
		const maxCanDo = gearBank.bank.fits(baseCost);
		if (maxCanDo === 0) {
			return `You need ${Items.itemNameFromId(fish.bait)} to fish ${fish.name}!`;
		}
		if (maxCanDo < quantity) {
			quantity = maxCanDo;
		}
	}

	const flakesQuantity = gearBank.bank.amount('Spirit flakes');

	const { catches, lootAmount, ticksElapsed, flakesUsed } = determineFishingTime({
		quantity,
		tripTicks,
		isPowerfishing,
		isUsingSpiritFlakes,
		fish,
		gearBank,
		invSlots,
		blessingChance,
		flakesQuantity,
		harpoonBoost,
		hasWildyEliteDiary
	});

	const totalCaught = catches.reduce((acc, curr) => acc + curr, 0);
	if (totalCaught === 0) {
		return `You can't fish any ${fish.name}. Try a higher quantity or ensure you have the required supplies.`;
	}

	const duration = Math.min(ticksElapsed, tripTicks) * TICK_DURATION;

	const cost = new Bank();
	if (fish.bait) {
		cost.add(fish.bait, totalCaught);
	}
	if (!isPowerfishing && flakesUsed > 0) {
		cost.add('Spirit flakes', flakesUsed);
	}

	return {
		cost,
		duration,
		quantity: totalCaught,
		boosts,
		catches,
		loot: lootAmount,
		flakesBeingUsed: !isPowerfishing ? flakesUsed : undefined,
		flakesToRemove: !isPowerfishing ? flakesUsed : undefined,
		powerfishing: isPowerfishing,
		spiritFlakes: isUsingSpiritFlakes,
		fish
	};
}
