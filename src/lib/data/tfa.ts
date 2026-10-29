import type { GearStats } from '@oldschoolgg/gear';
import { Items } from 'oldschooljs';

import { type TFABoss, TFABosses, type TFATeamMember } from '@/lib/simulation/tfa.js';
import { constructGearSetup } from '@/lib/structures/Gear.js';

export const TFAElementalStaves = ['Harmonised nightmare staff', 'Twinflame staff', 'Kodai wand'];
export const TFAMageWeapons = [
	...TFAElementalStaves,
	'Trident of the swamp',
	'Sanguinesti staff',
	"Tumeken's shadow",
	"Zorya's tome",
	'Eye of ayak'
];
export const TFAElementalTomes = [
	{ element: 'fire', items: ['Tome of fire', 'Tome of fire (empty)'], page: 'Burnt page' },
	{ element: 'water', items: ['Tome of water', 'Tome of water (empty)'], page: 'Soaked page' },
	{ element: 'earth', items: ['Tome of earth', 'Tome of earth (empty)'], page: 'Soiled page' }
] as const;

// https://oldschool.runescape.wiki/w/The_Fractured_Archive/Strategies
// These benchmarks and all weights below are bot balancing estimates, not a DPS calculation.
export const TFAMaxMeleeGear = constructGearSetup({
	head: "Inquisitor's great helm",
	body: "Inquisitor's hauberk",
	legs: "Inquisitor's plateskirt",
	neck: 'Amulet of rancour',
	cape: 'Infernal cape',
	hands: 'Ferocious gloves',
	feet: 'Avernic treads (max)',
	ring: 'Ultor ring',
	'2h': 'Obligator (base)'
});
export const TFAMaxRangeGear = constructGearSetup({
	head: 'Masori mask (f)',
	body: 'Masori body (f)',
	legs: 'Masori chaps (f)',
	neck: 'Necklace of anguish',
	cape: "Blessed dizana's quiver",
	hands: 'Zaryte vambraces',
	feet: 'Avernic treads (max)',
	ring: 'Venator ring',
	'2h': 'Twisted bow',
	ammo: 'Dragon arrow'
});
export const TFAMaxMageGear = constructGearSetup({
	head: 'Ancestral hat',
	body: 'Ancestral robe top',
	legs: 'Ancestral robe bottom',
	neck: 'Occult necklace',
	cape: 'Imbued saradomin cape',
	hands: 'Confliction gauntlets',
	feet: 'Avernic treads (max)',
	ring: 'Magus ring',
	weapon: 'Harmonised nightmare staff',
	shield: 'Tome of fire'
});

const meleeWeapons: [string[], number][] = [
	[['Obligator (base)'], 1],
	[['Scythe of vitur'], 0.9],
	[['Soulreaper axe'], 0.85],
	[['Abyssal bludgeon', 'Ursine chainmace'], 0.8],
	[['Zamorakian hasta'], 0.75]
];
const mageWeapons: [string[], number][] = [
	[['Harmonised nightmare staff', "Tumeken's shadow"], 0.9],
	[['Twinflame staff'], 0.85],
	[["Zorya's tome"], 0.85],
	[['Kodai wand', 'Eye of ayak'], 0.8],
	[['Sanguinesti staff'], 0.75],
	[['Trident of the swamp'], 0.7]
];

const bossStyleWeights: Record<TFABoss, { melee: number; range: number; mage: number }> = {
	guardian: { melee: 0.45, range: 0.4, mage: 0.15 },
	ezekiel: { melee: 0.85, range: 0.15, mage: 0 },
	bork: { melee: 0.7, range: 0.3, mage: 0 },
	moia: { melee: 0, range: 0.65, mage: 0.35 },
	dreadnoth: { melee: 0, range: 0.5, mage: 0.5 },
	xarth: { melee: 0.5, range: 0.25, mage: 0.25 },
	dagonhai: { melee: 0, range: 0.35, mage: 0.65 },
	ocellus: { melee: 0.7, range: 0.2, mage: 0.1 }
};

function scoreSetup(
	stats: GearStats,
	benchmark: GearStats,
	accuracy: 'attack_crush' | 'attack_ranged' | 'attack_magic',
	strength: 'melee_strength' | 'ranged_strength' | 'magic_damage'
) {
	const accuracyScore = Math.max(0, Math.min(1, stats[accuracy] / benchmark[accuracy]));
	const strengthScore = Math.max(0, Math.min(1, stats[strength] / benchmark[strength]));
	return (accuracyScore * 0.4 + strengthScore * 0.6) * 100;
}

export function calculateTFAGear(user: Pick<MUser, 'gear' | 'getBlowpipe'>): TFATeamMember['gear'] {
	const { melee: meleeGear, range: rangeGear, mage: mageGear } = user.gear;
	const meleeMultiplier = meleeWeapons.find(([items]) => meleeGear.hasEquipped(items))?.[1] ?? 0.7;
	const melee =
		scoreSetup(meleeGear.stats, TFAMaxMeleeGear.stats, 'attack_crush', 'melee_strength') * meleeMultiplier;
	const rangeStats = { ...rangeGear.stats };
	if (rangeGear.hasEquipped('Toxic blowpipe')) {
		rangeStats.ranged_strength +=
			Items.getItem(user.getBlowpipe().dartID ?? undefined)?.equipment?.ranged_strength ?? 0;
	}
	const range = scoreSetup(rangeStats, TFAMaxRangeGear.stats, 'attack_ranged', 'ranged_strength');
	const mageMultiplier = mageWeapons.find(([items]) => mageGear.hasEquipped(items))?.[1] ?? 0.7;
	const mage = scoreSetup(mageGear.stats, TFAMaxMageGear.stats, 'attack_magic', 'magic_damage') * mageMultiplier;
	const elementalStaff = mageGear.hasEquipped(TFAElementalStaves);
	const tome = TFAElementalTomes.find(t => mageGear.hasEquipped([...t.items]));
	const venatorBow = rangeGear.hasEquipped('Venator bow');
	const bosses = {} as Record<TFABoss, number>;
	for (const boss of Object.keys(TFABosses) as TFABoss[]) {
		let roomMage = mage;
		let roomRange = range;
		// Fire helps against the Guardian and Dreadnoth; water helps with Xarth's corpses.
		const element = boss === 'guardian' || boss === 'dreadnoth' ? 'fire' : boss === 'xarth' ? 'water' : null;
		if (elementalStaff && (element !== null || boss === 'dagonhai')) {
			roomMage = Math.min(100, mage + 5 + (tome && (tome.element === element || boss === 'dagonhai') ? 5 : 0));
		}
		if (venatorBow && (boss === 'moia' || boss === 'dreadnoth')) roomRange = Math.min(100, range + 8);
		const weights = bossStyleWeights[boss];
		bosses[boss] = melee * weights.melee + roomRange * weights.range + roomMage * weights.mage;
	}
	return { melee, range, mage, total: (melee + range + mage) / 3, bosses };
}
