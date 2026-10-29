import { Time } from '@oldschoolgg/toolkit';
import { Bank, Items, resolveItems, SimpleTable } from 'oldschooljs';

import type { Skills } from '@/lib/types/index.js';
import { assert } from '@/lib/util/logError.js';

// PROVISIONAL: timings, difficulty, requirements, XP and all reward rates are bot balancing estimates.
// Update these together once the raid is better understood. Quantities below are observed wiki samples.
export const TFA_BALANCING = {
	questPoints: 180,
	minimumGearPercent: 45,
	skills: {
		attack: 90,
		strength: 90,
		defence: 90,
		hitpoints: 90,
		ranged: 90,
		magic: 94,
		prayer: 80
	} satisfies Skills,
	maxQuantity: 5,
	proficiencyKC: 100,
	proficiencyAttempts: 200,
	baseDeathChance: 65,
	minimumDeathChance: 4,
	gearDeathPenalty: 15,
	soloDeathPenalty: 8,
	gearSpeedReduction: 0.25,
	learningSpeedReduction: 0.3,
	durationVariation: 5,
	deathPenalty: Time.Second * 30,
	uniquePercentPerPlayer: 3,
	maximumUniquePercent: 25,
	standardRolls: 3,
	// Guess: a deathless player receives one boosted standard roll; the wiki's trigger is unknown.
	deathlessLootMultiplier: 5,
	standardWeight: 16,
	// Estimated tertiary chance, close to the previous model's overall fragment frequency.
	fragmentRate: 45,
	elementalCastsPerRaid: 180,
	quartermasterAfterBoss: 3,
	// Estimated replacements from the Alliance Supplies stock, adjusted for early participation.
	// Quartermaster food (e.g. manta rays) replaces carried sharks; nothing leaves the raid.
	quartermasterSupplies: [
		{ name: 'Saradomin brew(4)', maximum: 2 },
		{ name: 'Super restore(4)', maximum: 1 },
		{ name: 'Shark', maximum: 2 }
	],
	ammunitionPerRaid: 180,
	blowpipeScalesPerRaid: 600,
	itemChargesPerRaid: 250,
	serpHelmChargesPerRaid: 600,
	deathFee: 500_000,
	learnerDeathFee: 125_000,
	learnerCompletions: 5,
	// https://oldschool.runescape.wiki/w/Living_record_(tier_1) through tier 5.
	livingRecordKC: [100, 500, 1000, 1500, 2000],
	xp: { melee: 48_000, ranged: 12_000, magic: 12_000, hitpoints: 24_000 },
	tertiaries: [
		{ name: 'Orion', rate: 650 },
		{ name: "Archivist's folio (inert)", rate: 10 },
		{ name: 'Clue scroll (elite)', rate: 25 }
	]
} as const;

export const TFA_PROVISIONAL_MESSAGE =
	'Your minion has no clue what they are doing. Good luck! TFA timings, gear scores, difficulty and drop rates are provisional.';

export const TFABosses = {
	guardian: { name: 'Archive Guardian', minutes: 10, difficulty: 0.9, styles: ['melee', 'mage', 'range'] },
	ezekiel: { name: 'Ezekiel', minutes: 12, difficulty: 1.05, styles: ['melee', 'range'] },
	bork: { name: 'Bork and the Smorks', minutes: 12, difficulty: 1, styles: ['melee', 'range'] },
	moia: { name: 'Moia', minutes: 13, difficulty: 1.1, styles: ['mage', 'range'] },
	dreadnoth: { name: 'Dreadnoth the Jellied', minutes: 13, difficulty: 1.15, styles: ['mage', 'range'] },
	xarth: { name: 'Xarth', minutes: 14, difficulty: 1.1, styles: ['melee', 'mage', 'range'] },
	dagonhai: { name: "Dagon'hai Elder and monks", minutes: 14, difficulty: 1.05, styles: ['mage', 'range'] },
	ocellus: { name: 'Ocellus', minutes: 22, difficulty: 1.3, styles: ['melee', 'mage', 'range'] }
} as const;

export type TFABoss = keyof typeof TFABosses;
export interface TFARouteChoices {
	second?: 'ezekiel' | 'bork';
	third?: 'moia' | 'dreadnoth';
	fourth?: 'xarth' | 'dagonhai';
}

export interface TFATeamMember {
	id: string;
	kc: number;
	attempts: number;
	gear: { melee: number; mage: number; range: number; total: number; bosses?: Record<TFABoss, number> };
}

export interface TFARaidResult {
	route: TFABoss[];
	members: { id: string; deaths: number[] }[];
	wipedRoom: number | null;
	duration: number;
	fakeDuration: number;
}

export const TFAUniqueTable = new SimpleTable<string>()
	// ToB/ToA-style weighting: common prayer unlock, three mid-tier rewards, one mega-rare.
	.add('Horn of Bran', 8)
	.add('Rondache', 3)
	.add("Zorya's tome (uncharged)", 3)
	.add('Ascension crossbows', 3)
	.add('Obligator (uncharged) (base)', 1);

export const TFAUniques = resolveItems(TFAUniqueTable.table.map(i => i.item));
export const TFAFragments = resolveItems([
	'Fragment of whispering wind',
	'Fragment of deep water',
	'Fragment of living earth',
	'Fragment of burning fire'
]);

export const TFALivingRecords = resolveItems([
	'Living record (tier 1)',
	'Living record (tier 2)',
	'Living record (tier 3)',
	'Living record (tier 4)',
	'Living record (tier 5)'
]);

// Keep unavailable rewards visible if item definitions lag behind a game update.
export const TFAPendingRewards = TFA_BALANCING.tertiaries.filter(i => !Items.getItem(i.name));
export const TFACollectionLog = [
	...TFAUniques,
	...TFAFragments,
	...TFALivingRecords,
	...resolveItems('Ascension shards'),
	...TFA_BALANCING.tertiaries
		.filter(i => i.name !== 'Clue scroll (elite)')
		.flatMap(i => {
			const item = Items.getItem(i.name);
			return item ? [item.id] : [];
		})
];

const standardLoot: [string, number, number][] = [
	['Battlestaff', 34, 36],
	['Dragon platelegs', 1, 1],
	['Dragon plateskirt', 1, 1],
	['Rune kiteshield', 6, 6],
	['Nature rune', 311, 342],
	['Astral rune', 303, 358],
	['Blood rune', 302, 321],
	['Soul rune', 310, 342],
	['Earth rune', 3063, 3351],
	['Grimy harralander', 60, 64],
	['Grimy ranarr weed', 18, 19],
	['Grimy toadflax', 24, 28],
	['Snapdragon seed', 3, 3],
	['Kwuarm seed', 7, 7],
	['Snape grass seed', 7, 7],
	['Yew seed', 4, 4],
	['Iron ore', 859, 887],
	['Adamantite ore', 61, 67],
	['Runite ore', 25, 26],
	['Sapphire', 24, 25],
	['Emerald', 24, 25],
	['Ruby', 24, 25],
	['Diamond', 24, 25],
	['Ascension shards', 75, 78],
	['Desiccated page', 31, 33],
	['Aether catalyst', 182, 189],
	['Pure essence', 1427, 1630],
	['Mahogany logs', 140, 145],
	['Onyx bolt tips', 50, 58],
	['Dragon arrowtips', 351, 367],
	['Earth orb', 68, 71],
	['Raw shark', 81, 89],
	['Wine of zamorak', 32, 34]
];

const standardTable = new SimpleTable<{ id: number; min: number; max: number }>();
for (const [name, min, max] of standardLoot) {
	standardTable.add({ id: Items.getOrThrow(name).id, min, max }, TFA_BALANCING.standardWeight);
}

export function resolveTFARoute(choices: TFARouteChoices, rng: RNGProvider): TFABoss[] {
	return [
		'guardian',
		choices.second ?? (rng.roll(2) ? 'ezekiel' : 'bork'),
		choices.third ?? (rng.roll(2) ? 'moia' : 'dreadnoth'),
		choices.fourth ?? (rng.roll(2) ? 'xarth' : 'dagonhai'),
		'ocellus'
	];
}

function learning(member: TFATeamMember) {
	return Math.min(1, member.kc / TFA_BALANCING.proficiencyKC + member.attempts / TFA_BALANCING.proficiencyAttempts);
}

export function tfaDeathChance(member: TFATeamMember, boss: TFABoss, solo: boolean): number {
	const room = TFABosses[boss];
	const gear = tfaBossGear(member, boss);
	return Math.min(
		95,
		(TFA_BALANCING.baseDeathChance -
			learning(member) * (TFA_BALANCING.baseDeathChance - TFA_BALANCING.minimumDeathChance) +
			(1 - gear / 100) * TFA_BALANCING.gearDeathPenalty +
			(solo ? TFA_BALANCING.soloDeathPenalty : 0)) *
			room.difficulty
	);
}

function tfaBossGear(member: TFATeamMember, boss: TFABoss): number {
	const room = TFABosses[boss];
	return (
		member.gear.bosses?.[boss] ??
		room.styles.reduce((sum, style) => sum + member.gear[style], 0) / room.styles.length
	);
}

export function tfaRaidDuration(team: TFATeamMember[], route: TFABoss[]): number {
	assert(team.length >= 1 && team.length <= 8, 'TFA requires 1-8 players.');
	const duration = route.reduce((sum, boss) => {
		const averageReduction =
			team.reduce(
				(total, member) =>
					total +
					(tfaBossGear(member, boss) / 100) * TFA_BALANCING.gearSpeedReduction +
					learning(member) * TFA_BALANCING.learningSpeedReduction,
				0
			) / team.length;
		return sum + TFABosses[boss].minutes * Time.Minute * (1 - averageReduction);
	}, 0);
	// Solo HP scales to two players. Larger teams receive a modest speed benefit.
	const scale = (Math.max(2, team.length) / team.length) * (1 - (team.length - 1) * 0.015);
	return Math.floor(duration * scale);
}

export function simulateTFARaid(team: TFATeamMember[], route: TFABoss[], rng: RNGProvider): TFARaidResult {
	assert(new Set(team.map(i => i.id)).size === team.length, 'TFA team members must be distinct.');
	const roomDurations = route.map(boss => tfaRaidDuration(team, [boss]));
	const totalDuration = roomDurations.reduce((sum, duration) => sum + duration, 0);
	const fullDuration = Math.floor(rng.randomVariation(totalDuration, TFA_BALANCING.durationVariation));
	const members = team.map(member => ({ id: member.id, deaths: [] as number[] }));
	let duration = 0;
	let wipedRoom: number | null = null;
	for (const [index, boss] of route.entries()) {
		for (const [memberIndex, member] of team.entries()) {
			if (rng.percentChance(tfaDeathChance(member, boss, team.length === 1))) {
				members[memberIndex].deaths.push(index);
			}
		}
		const roomDuration = (roomDurations[index] / totalDuration) * fullDuration;
		if (members.every(member => member.deaths.includes(index))) {
			duration += roomDuration * rng.randFloat(0.3, 0.9);
			wipedRoom = index;
			break;
		}
		duration += roomDuration;
		duration +=
			(members.filter(member => member.deaths.includes(index)).length * TFA_BALANCING.deathPenalty) / team.length;
	}
	return {
		route,
		members,
		wipedRoom,
		duration: Math.floor(duration),
		fakeDuration: Math.max(fullDuration, Math.floor(duration))
	};
}

export function tfaDeathFee(raid: TFARaidResult, kc: number): number {
	if (raid.wipedRoom === null) return 0;
	return kc < TFA_BALANCING.learnerCompletions ? TFA_BALANCING.learnerDeathFee : TFA_BALANCING.deathFee;
}

export function tfaQuartermasterRefund(raid: TFARaidResult, userID: string, reserved: Bank, quantity = 1): Bank {
	const refund = new Bank();
	const afterBoss = TFA_BALANCING.quartermasterAfterBoss;
	if (raid.wipedRoom !== null && raid.wipedRoom < afterBoss) return refund;
	const member = raid.members.find(member => member.id === userID);
	if (!member) return refund;
	const participation = (afterBoss - member.deaths.filter(room => room < afterBoss).length) / afterBoss;
	const remainingShare = (raid.route.length - afterBoss) / raid.route.length;
	for (const { name, maximum } of TFA_BALANCING.quartermasterSupplies) {
		const carriedPerRaid = Math.floor(reserved.amount(name) / quantity);
		const amount = Math.min(Math.floor(maximum * participation), Math.floor(carriedPerRaid * remainingShare));
		if (amount > 0) refund.add(name, amount);
	}
	return refund;
}

export function rollTFALoot(
	raid: TFARaidResult,
	rng: RNGProvider,
	fragmentLogs: ReadonlyMap<string, Bank> = new Map()
) {
	const loot = new Map(raid.members.map(member => [member.id, new Bank()]));
	if (raid.wipedRoom !== null) return { loot, uniqueChance: 0 };
	const recipients = new SimpleTable<string>();
	let survivingRooms = 0;
	for (const member of raid.members) {
		const survived = raid.route.length - member.deaths.length;
		survivingRooms += survived;
		recipients.add(member.id, survived);
		const bank = loot.get(member.id)!;
		if (survived === 0) {
			bank.add('Cabbage');
			continue;
		}
		for (let i = 0; i < TFA_BALANCING.standardRolls; i++) {
			const drop = standardTable.rollOrThrow(rng);
			const multiplier = member.deaths.length === 0 && i === 0 ? TFA_BALANCING.deathlessLootMultiplier : 1;
			bank.add(drop.id, rng.randInt(drop.min, drop.max) * multiplier);
		}
		if (rng.roll(TFA_BALANCING.fragmentRate)) {
			// Duplicate protection is confirmed, but the exact rule is not published. Our provisional
			// model favours the least-awarded elements, using the log so consumed fragments still count.
			const log = fragmentLogs.get(member.id);
			const minimum = Math.min(...TFAFragments.map(id => log?.amount(id) ?? 0));
			bank.add(rng.pick(TFAFragments.filter(id => (log?.amount(id) ?? 0) === minimum)));
		}
		for (const { name, rate } of TFA_BALANCING.tertiaries) {
			const item = Items.getItem(name);
			if (item && rng.roll(rate)) bank.add(item.id);
		}
	}
	const uniqueChance = Math.min(
		TFA_BALANCING.maximumUniquePercent,
		(survivingRooms / raid.route.length) * TFA_BALANCING.uniquePercentPerPlayer
	);
	if (rng.percentChance(uniqueChance)) {
		loot.get(recipients.rollOrThrow(rng))!.add(TFAUniqueTable.rollOrThrow(rng));
	}
	return { loot, uniqueChance };
}
