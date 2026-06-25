import { Time } from '@oldschoolgg/toolkit';
import { Bank, Items } from 'oldschooljs';

import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { MAX_CLUES_DROPPED } from '@/lib/constants.js';
import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';
import { STARTER_SAIL_TRIM_DATA } from '@/lib/skilling/skills/sailing/upgrades.js';

const oceanManDrinks = [
	'Short green guy',
	'Blurberry special',
	'Fruit blast',
	'Pineapple punch',
	'Drunk dragon',
	'Choc saturday',
	'Wizard blizzard'
];

const mysteriousGlowGems = [
	'Uncut opal',
	'Uncut sapphire',
	'Uncut emerald',
	'Uncut ruby',
	'Uncut diamond',
	'Uncut red topaz',
	'Uncut dragonstone'
];

const giantClamPearls = [
	{ name: 'Tiny pearl', min: 1, max: 199 },
	{ name: 'Small pearl', min: 202, max: 996 },
	{ name: 'Shiny pearl', min: 1005, max: 1920 },
	{ name: 'Bright pearl', min: 2040, max: 4800 },
	{ name: 'Big pearl', min: 5400, max: 9984 },
	{ name: 'Huge pearl', min: 10_200, max: 19_200 },
	{ name: 'Enormous pearl', min: 20_400, max: 49_800 },
	{ name: 'Shimmering pearl', min: 50_000, max: 96_000 },
	{ name: 'Glistening pearl', min: 112_500, max: 183_000 },
	{ name: 'Brilliant pearl', min: 240_000, max: 480_000 },
	{ name: 'Radiant pearl', min: 540_000, max: Number.POSITIVE_INFINITY }
];

type OceanEncounter =
	| 'strong_winds'
	| 'mysterious_glow'
	| 'lost_crate'
	| 'castaway'
	| 'giant_clam'
	| 'clue_turtle'
	| 'ocean_man'
	| 'lost_casket';

const encounterWeights: Array<{ encounter: OceanEncounter; weight: number }> = [
	{ encounter: 'strong_winds', weight: 600 },
	{ encounter: 'mysterious_glow', weight: 120 },
	{ encounter: 'lost_crate', weight: 120 },
	{ encounter: 'castaway', weight: 60 },
	{ encounter: 'giant_clam', weight: 60 },
	{ encounter: 'clue_turtle', weight: 25 },
	{ encounter: 'ocean_man', weight: 12 },
	{ encounter: 'lost_casket', weight: 1 }
];

const lostCrateTiers = [
	{ level: 5, xp: 25, loot: ['Steel arrow', 'Sawmill coupon (wood plank)', 'Sweetcorn seed', 'Leather'] },
	{ level: 26, xp: 50, loot: ['Mithril arrow', 'Sawmill coupon (oak plank)', 'Willow seed', 'Snakeskin'] },
	{ level: 51, xp: 150, loot: ['Adamant arrow', 'Teak plank', 'Ranarr seed', 'Green dragon leather'] },
	{ level: 71, xp: 235, loot: ['Rune arrow', 'Mahogany plank', 'Watermelon seed', 'Red dragon leather'] },
	{ level: 86, xp: 335, loot: ['Amethyst arrow', 'Camphor plank', 'Yew seed', 'Black dragon leather'] },
	{ level: 95, xp: 450, loot: ['Dragon arrow', 'Ironwood plank', 'Spirit seed', 'Dragon metal sheet'] }
];

function rollEncounter(rng: RNGProvider): OceanEncounter {
	const totalWeight = encounterWeights.reduce((total, entry) => total + entry.weight, 0);
	let roll = rng.randInt(1, totalWeight);
	for (const entry of encounterWeights) {
		roll -= entry.weight;
		if (roll <= 0) return entry.encounter;
	}
	return 'strong_winds';
}

function getClueTierForLevel(level: number, rng: RNGProvider) {
	if (level < 5) return null;
	if (level < 30) return ClueTiers.find(tier => tier.name === 'Easy')!;
	const roll = rng.randInt(1, 20);
	if (level < 50) {
		return roll <= 8
			? ClueTiers.find(tier => tier.name === 'Easy')!
			: ClueTiers.find(tier => tier.name === 'Medium')!;
	}
	if (level < 70) {
		if (roll <= 9) return ClueTiers.find(tier => tier.name === 'Easy')!;
		if (roll <= 15) return ClueTiers.find(tier => tier.name === 'Medium')!;
		return ClueTiers.find(tier => tier.name === 'Hard')!;
	}
	if (roll <= 9) return ClueTiers.find(tier => tier.name === 'Easy')!;
	if (roll <= 15) return ClueTiers.find(tier => tier.name === 'Medium')!;
	if (roll <= 18) return ClueTiers.find(tier => tier.name === 'Hard')!;
	return ClueTiers.find(tier => tier.name === 'Elite')!;
}

function getMysteriousGlowXP(level: number) {
	if (level < 9) return 0;
	if (level <= 40) return 120;
	if (level <= 60) return 248;
	if (level <= 70) return 504;
	if (level <= 80) return 1016;
	if (level <= 90) return 2040;
	return 4088;
}

function getPearl(highAlchValue: number) {
	return (
		giantClamPearls.find(pearl => highAlchValue >= pearl.min && highAlchValue <= pearl.max) ?? giantClamPearls[0]
	).name;
}

function rollEncounterCount(duration: number, rng: RNGProvider) {
	const intervals = Math.floor(duration / (120 * Time.Second * 0.6));
	let failedIntervals = 0;
	let encounters = 0;
	for (let i = 0; i < intervals; i++) {
		const chance = Math.min(6, failedIntervals + 1);
		if (rng.randInt(1, 6) <= chance) {
			encounters++;
			failedIntervals = 0;
		} else {
			failedIntervals++;
		}
	}
	return encounters;
}

export function rollOceanEncounters({
	duration,
	sailingLevel,
	facilities,
	clamItemId,
	clamFedAt,
	user,
	rng
}: {
	duration: number;
	sailingLevel: number;
	facilities: SailingFacilityId[];
	clamItemId?: number | null;
	clamFedAt?: number | null;
	user: MUser;
	rng: RNGProvider;
}) {
	const loot = new Bank();
	const messages: string[] = [];
	let xp = 0;
	let clamConsumed = false;
	const encounters = rollEncounterCount(duration, rng);

	for (let i = 0; i < encounters; i++) {
		const encounter = rollEncounter(rng);
		switch (encounter) {
			case 'strong_winds': {
				const catcher = facilities.includes('gale_catcher')
					? 'gale_catcher'
					: facilities.includes('wind_catcher')
						? 'wind_catcher'
						: null;
				const trimXP = STARTER_SAIL_TRIM_DATA.xp * 4 * (catcher ? 0.75 : 1);
				const moteXP = catcher ? 4 * (catcher === 'gale_catcher' ? 70 : 40) : 0;
				xp += trimXP + moteXP;
				messages.push('Strong winds allowed 4 extra sail trims.');
				break;
			}
			case 'mysterious_glow': {
				const glowXP = getMysteriousGlowXP(sailingLevel);
				if (glowXP === 0) break;
				xp += glowXP;
				loot.add(mysteriousGlowGems[rng.randInt(0, mysteriousGlowGems.length - 1)]);
				messages.push(`Mysterious glow: ${glowXP.toLocaleString()} Sailing XP.`);
				break;
			}
			case 'lost_crate': {
				const tier = [...lostCrateTiers].reverse().find(entry => sailingLevel >= entry.level);
				if (!tier) break;
				const item = tier.loot[rng.randInt(0, tier.loot.length - 1)];
				loot.add(item);
				xp += tier.xp;
				messages.push(`Lost crate: ${item} and ${tier.xp} Sailing XP.`);
				break;
			}
			case 'castaway': {
				const castawayXP = sailingLevel * 15;
				xp += castawayXP;
				messages.push(`Castaway rescued and delivered: ${castawayXP.toLocaleString()} Sailing XP.`);
				break;
			}
			case 'giant_clam': {
				if (sailingLevel < 40 || !clamItemId || !clamFedAt || Date.now() - clamFedAt < Time.Hour) break;
				const item = Items.get(clamItemId);
				const highAlchValue = item?.highalch ?? (item?.name === 'Coins' ? 1 : 0);
				const pearl = getPearl(highAlchValue);
				loot.add(pearl);
				xp += sailingLevel * 15;
				clamConsumed = true;
				messages.push(`Giant clam polished ${item?.name ?? 'an item'} into a ${pearl}.`);
				break;
			}
			case 'clue_turtle': {
				if (sailingLevel < 5) break;
				xp += 50;
				const clueTier = getClueTierForLevel(sailingLevel, rng);
				if (!clueTier) break;
				const clueStack = ClueTiers.reduce((total, tier) => total + user.bank.amount(tier.scrollID), 0);
				if (clueStack < MAX_CLUES_DROPPED) {
					loot.add(clueTier.scrollID);
					messages.push(`Clue turtle: ${clueTier.name} clue scroll.`);
				}
				break;
			}
			case 'ocean_man': {
				const drink = oceanManDrinks[rng.randInt(0, oceanManDrinks.length - 1)];
				loot.add(drink);
				messages.push(`Ocean Man gave you a ${drink}.`);
				break;
			}
			case 'lost_casket': {
				const eligibleTiers = ClueTiers.filter(
					tier =>
						tier.name !== 'Master' &&
						sailingLevel >=
							({ Beginner: 1, Easy: 5, Medium: 30, Hard: 50, Elite: 70 } as const)[
								tier.name as 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Elite'
							]
				);
				if (eligibleTiers.length === 0) break;
				const clueTier = eligibleTiers[eligibleTiers.length - 1];
				loot.add(clueTier.table.roll());
				const casketXP =
					({ Beginner: 25, Easy: 50, Medium: 150, Hard: 235, Elite: 335 } as Record<string, number>)[
						clueTier.name
					] ?? 0;
				xp += casketXP;
				messages.push(`Lost casket: one ${clueTier.name.toLowerCase()} reward roll.`);
				break;
			}
		}
	}

	return { encounters, loot, xp, messages, clamConsumed };
}
