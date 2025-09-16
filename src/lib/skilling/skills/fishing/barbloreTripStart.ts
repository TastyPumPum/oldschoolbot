import { Time } from '@oldschoolgg/toolkit/datetime';
import { Bank, itemID } from 'oldschooljs';

import type { GearBank } from '@/lib/structures/GearBank';
import type { Mixable } from '@/lib/skilling/types';
import { logError } from '@/lib/util/logError';

import type { Fish } from '../../types';
import { barbMixes } from '@/lib/skilling/skills/herblore/mixables/barbMixes';
import { calcFishingTripStart } from './fishingTripStart';

const ROE_ID = itemID('Roe');
const CAVIAR_ID = itemID('Caviar');

let hasEnsuredActivityType = false;

export async function ensureBarbloreActivityType() {
if (hasEnsuredActivityType) {
return;
}
try {
await prisma.$executeRawUnsafe(
`ALTER TYPE "activity_type_enum" ADD VALUE IF NOT EXISTS 'BarbloreFishing';`
);
} catch (error) {
logError(error, { context: 'ensureBarbloreActivityType' });
} finally {
hasEnsuredActivityType = true;
}
}

interface MixPlan {
ingredient: 'Roe' | 'Caviar';
mix: Mixable;
potionID: number;
potionName: string;
quantity: number;
}

export interface BarbloreTripStartResult {
cost: Bank;
duration: number;
quantity: number;
boosts: string[];
xp: {
fishing: number;
agility: number;
strength: number;
herblore: number;
cooking: number;
};
xpPerHour: {
fishing: number;
agility: number;
strength: number;
herblore: number;
cooking: number;
};
mixPlan: MixPlan[];
leftoverFish: {
trout: number;
salmon: number;
sturgeon: number;
};
leftoverIngredients: {
roe: number;
caviar: number;
};
ingredientsUsed: {
roe: number;
caviar: number;
};
fishOffcuts: number;
originalQuantity?: number;
}

function pickBestMix(
mixes: Mixable[],
ingredient: 'Roe' | 'Caviar',
herbloreLevel: number,
bank: GearBank['bank']
): (MixPlan & { available: number }) | null {
const filtered = mixes
.filter(mix => mix.level <= herbloreLevel)
.sort((a, b) => b.xp - a.xp);
for (const mix of filtered) {
const potionEntry = mix
.inputItems
.items()
.find(([item]) => item.id !== (ingredient === 'Roe' ? ROE_ID : CAVIAR_ID));
if (!potionEntry) {
continue;
}
const [potionItem] = potionEntry;
const available = bank.amount(potionItem.id);
if (available > 0) {
return {
ingredient,
mix,
potionID: potionItem.id,
potionName: potionItem.name,
quantity: 0,
available
};
}
}
return null;
}

export function calcBarbloreTripStart({
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
}): string | BarbloreTripStartResult {
if (wantsToUseFlakes) {
return 'Spirit flakes cannot be used with the Barblore method.';
}
const baseStart = calcFishingTripStart({
gearBank,
fish,
maxTripLength,
quantityInput,
wantsToUseFlakes: false
});
if (typeof baseStart === 'string') {
return baseStart;
}
const cost = new Bank(baseStart.cost);
const boosts = [...baseStart.boosts];
const quantity = baseStart.quantity;
const duration = baseStart.duration;

const stats = gearBank.skillsAsLevels;
const fishingLevel = stats.fishing;
const agilityLevel = stats.agility;
const strengthLevel = stats.strength;
const cookingLevel = stats.cooking;
const herbloreLevel = stats.herblore;

const canSturgeon =
fishingLevel >= 70 && agilityLevel >= 45 && strengthLevel >= 45;
const canSalmon =
fishingLevel >= 58 && agilityLevel >= 30 && strengthLevel >= 30;

const sturgeonChance = canSturgeon ? 255 / (8 + Math.floor(0.5714 * fishingLevel)) : null;
const salmonChance = canSalmon ? 255 / (16 + Math.floor(0.8616 * fishingLevel)) : null;
const troutChance = 255 / (32 + Math.floor(1.632 * fishingLevel));

const sturgeonProbability = sturgeonChance ? 1 / sturgeonChance : 0;
const salmonProbability = salmonChance ? 1 / salmonChance : 0;
const troutProbability = 1 / troutChance;

const sturgeonCount = Math.min(quantity, Math.round(quantity * sturgeonProbability));
const remainingAfterSturgeon = Math.max(0, quantity - sturgeonCount);
const salmonCount = Math.min(
remainingAfterSturgeon,
Math.round(remainingAfterSturgeon * salmonProbability)
);
const remainingAfterSalmon = Math.max(0, remainingAfterSturgeon - salmonCount);
const troutCount = remainingAfterSalmon;

const fishingXP = sturgeonCount * 80 + salmonCount * 70 + troutCount * 50;
const agilityXP = sturgeonCount * 7 + salmonCount * 6 + troutCount * 5;
const strengthXP = agilityXP;

const troutRoeChance = Math.min(1, (0.67 * cookingLevel) / 100);
const salmonRoeChance = Math.min(1, (1.25 * cookingLevel) / 100);
const sturgeonCaviarChance = Math.min(1, (1.25 * cookingLevel) / 100);

const roeFromTrout = Math.min(troutCount, Math.round(troutCount * troutRoeChance));
const roeFromSalmon = Math.min(salmonCount, Math.round(salmonCount * salmonRoeChance));
const caviarFromSturgeon = Math.min(
sturgeonCount,
Math.round(sturgeonCount * sturgeonCaviarChance)
);

const totalRoe = roeFromTrout + roeFromSalmon;
const totalCaviar = caviarFromSturgeon;

const cookingXP = roeFromTrout * 10 + roeFromSalmon * 10 + caviarFromSturgeon * 15;

const roeMixes = barbMixes.filter(mix => mix.inputItems.has('Roe'));
const caviarMixes = barbMixes.filter(mix => mix.inputItems.has('Caviar'));

const roeMixPlan = pickBestMix(roeMixes, 'Roe', herbloreLevel, gearBank.bank);
const caviarMixPlan = pickBestMix(caviarMixes, 'Caviar', herbloreLevel, gearBank.bank);

const mixPlan: MixPlan[] = [];
let herbloreXP = 0;
let roeUsed = 0;
let caviarUsed = 0;

if (roeMixPlan) {
const quantityToMake = Math.min(totalRoe, roeMixPlan.available);
if (quantityToMake > 0) {
cost.add(roeMixPlan.potionID, quantityToMake);
mixPlan.push({
ingredient: 'Roe',
mix: roeMixPlan.mix,
potionID: roeMixPlan.potionID,
potionName: roeMixPlan.potionName,
quantity: quantityToMake
});
herbloreXP += quantityToMake * roeMixPlan.mix.xp;
roeUsed = quantityToMake;
}
}

if (caviarMixPlan) {
const quantityToMake = Math.min(totalCaviar, caviarMixPlan.available);
if (quantityToMake > 0) {
cost.add(caviarMixPlan.potionID, quantityToMake);
mixPlan.push({
ingredient: 'Caviar',
mix: caviarMixPlan.mix,
potionID: caviarMixPlan.potionID,
potionName: caviarMixPlan.potionName,
quantity: quantityToMake
});
herbloreXP += quantityToMake * caviarMixPlan.mix.xp;
caviarUsed = quantityToMake;
}
}

if (mixPlan.length === 0) {
return 'You need suitable (2) dose potions in your bank to create Barbarian mixes for Barblore.';
}

const leftoverRoe = Math.max(0, totalRoe - roeUsed);
const leftoverCaviar = Math.max(0, totalCaviar - caviarUsed);

const fishOffcuts =
Math.floor(roeFromTrout * 0.5) +
Math.floor(roeFromSalmon * 0.75) +
Math.floor(caviarFromSturgeon * (5 / 6));

const leftoverFish = {
trout: Math.max(0, troutCount - roeFromTrout),
salmon: Math.max(0, salmonCount - roeFromSalmon),
sturgeon: Math.max(0, sturgeonCount - caviarFromSturgeon)
};

if (mixPlan.length > 0) {
const mixSummary = mixPlan
.map(plan => `${plan.quantity.toLocaleString()}x ${plan.mix.item.name}`)
.join(', ');
boosts.push(`Barblore mixes: ${mixSummary}`);
}

const xp = {
fishing: fishingXP,
agility: agilityXP,
strength: strengthXP,
herblore: herbloreXP,
cooking: cookingXP
};

const xpPerHour = {
fishing: duration > 0 ? Math.floor((xp.fishing * Time.Hour) / duration) : 0,
agility: duration > 0 ? Math.floor((xp.agility * Time.Hour) / duration) : 0,
strength: duration > 0 ? Math.floor((xp.strength * Time.Hour) / duration) : 0,
herblore: duration > 0 ? Math.floor((xp.herblore * Time.Hour) / duration) : 0,
cooking: duration > 0 ? Math.floor((xp.cooking * Time.Hour) / duration) : 0
};

boosts.push(
`XP/hr — Fishing: ${xpPerHour.fishing.toLocaleString()}, Agility: ${xpPerHour.agility.toLocaleString()}, Strength: ${xpPerHour.strength.toLocaleString()}, Cooking: ${xpPerHour.cooking.toLocaleString()}, Herblore: ${xpPerHour.herblore.toLocaleString()}`
);

return {
cost,
duration,
quantity,
boosts,
xp,
xpPerHour,
mixPlan,
leftoverFish,
leftoverIngredients: { roe: leftoverRoe, caviar: leftoverCaviar },
ingredientsUsed: { roe: roeUsed, caviar: caviarUsed },
fishOffcuts,
originalQuantity: quantityInput
};
}

