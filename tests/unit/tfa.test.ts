import { Bank } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { calculateTFAGear } from '@/lib/data/tfa.js';
import {
	rollTFALoot,
	TFA_BALANCING,
	TFABosses,
	TFACollectionLog,
	TFAFragments,
	TFAPendingRewards,
	type TFARaidResult,
	type TFATeamMember,
	tfaDeathChance,
	tfaDeathFee,
	tfaQuartermasterRefund,
	tfaRaidDuration
} from '@/lib/simulation/tfa.js';
import { constructGearSetup } from '@/lib/structures/Gear.js';

function raid(deaths: number[] = [], wipedRoom: number | null = null): TFARaidResult {
	return {
		route: ['guardian', 'ezekiel', 'dreadnoth', 'xarth', 'ocellus'],
		members: [{ id: 'user', deaths }],
		wipedRoom,
		duration: 1,
		fakeDuration: 1
	};
}

function lootRng(fragment: boolean): RNGProvider {
	return {
		randInt: (min: number) => min,
		randFloat: (min: number) => min,
		roll: (rate: number) => fragment && rate === TFA_BALANCING.fragmentRate,
		percentChance: () => false,
		pick: <T>(items: T[]) => items[0]
	} as unknown as RNGProvider;
}

describe('TFA rewards', () => {
	test('charges only for team wipes and ends the learner discount at five completions', () => {
		expect(tfaDeathFee(raid([0, 2]), 0)).toBe(0);
		expect(tfaDeathFee(raid([0, 2]), 50)).toBe(0);
		expect(tfaDeathFee(raid([0], 0), 4)).toBe(125_000);
		expect(tfaDeathFee(raid([0], 0), 5)).toBe(500_000);
	});

	test('includes all 17 collection items after the item refresh', () => {
		expect(TFAPendingRewards).toEqual([]);
		expect(new Set(TFACollectionLog).size).toBe(17);
		expect(TFACollectionLog).toContain(34646);
		expect(TFACollectionLog).toContain(34722);
	});

	test('awards fragments in addition to three standard rolls', () => {
		const withoutFragment = rollTFALoot(raid(), lootRng(false)).loot.get('user')!;
		const withFragment = rollTFALoot(raid(), lootRng(true)).loot.get('user')!;
		expect(withFragment.filter(item => !TFAFragments.includes(item.id)).equals(withoutFragment)).toBe(true);
		expect(TFAFragments.reduce((sum, id) => sum + withFragment.amount(id), 0)).toBe(1);
	});

	test('prefers the least-logged element and can track earlier rewards in the same trip', () => {
		const log = new Bank();
		for (const id of TFAFragments.slice(0, -1)) log.add(id, 2);
		const logs = new Map([['user', log]]);
		const missing = TFAFragments[TFAFragments.length - 1];
		for (let i = 0; i < 2; i++) {
			const loot = rollTFALoot(raid(), lootRng(true), logs).loot.get('user')!;
			expect(loot.amount(missing)).toBe(1);
			log.add(loot.filter(item => TFAFragments.includes(item.id)));
		}
		const next = rollTFALoot(raid(), lootRng(true), logs).loot.get('user')!;
		expect(next.amount(TFAFragments[0])).toBe(1);
	});

	test('does not award fragments or standard loot on a wipe', () => {
		expect(rollTFALoot(raid([0], 0), lootRng(true)).loot.get('user')!.length).toBe(0);
	});
});

describe('TFA quartermaster', () => {
	const supplies = new Bank().add('Saradomin brew(4)', 8).add('Super restore(4)', 3).add('Shark', 6);

	test('becomes available only after completing the third boss', () => {
		expect(tfaQuartermasterRefund(raid([2], 2), 'user', supplies).length).toBe(0);
		const afterThird = tfaQuartermasterRefund(raid([3], 3), 'user', supplies);
		expect(afterThird.amount('Saradomin brew(4)')).toBe(2);
		expect(afterThird.amount('Super restore(4)')).toBe(1);
		expect(afterThird.amount('Shark')).toBe(2);
	});

	test('reduces the allowance for deaths before the resupply', () => {
		const deathless = tfaQuartermasterRefund(raid(), 'user', supplies);
		const learner = tfaQuartermasterRefund(raid([0]), 'user', supplies);
		expect(learner.amount('Saradomin brew(4)')).toBeLessThan(deathless.amount('Saradomin brew(4)'));
		expect(tfaQuartermasterRefund(raid([0, 1, 2]), 'user', supplies).length).toBe(0);
		expect(tfaQuartermasterRefund(raid(), 'simulated-copy', supplies).length).toBe(0);
	});

	test('caps replacements by the carried supplies for the last two rooms', () => {
		const reserved = new Bank().add('Saradomin brew(4)', 2).add('Super restore(4)', 1).add('Dragon arrow', 180);
		const refund = tfaQuartermasterRefund(raid(), 'user', reserved);
		expect(refund.length).toBe(0);
		expect(reserved.amount('Saradomin brew(4)')).toBe(2);
	});

	test('uses per-raid quantities for a batch and never returns ammunition', () => {
		const reserved = supplies.clone().multiply(3).add('Dragon arrow', 540);
		const perRaid = tfaQuartermasterRefund(raid(), 'user', reserved, 3);
		expect(perRaid.equals(tfaQuartermasterRefund(raid(), 'user', supplies))).toBe(true);
		expect(perRaid.amount('Dragon arrow')).toBe(0);
		expect(reserved.has(perRaid.clone().multiply(3))).toBe(true);
	});
});

describe('TFA gear', () => {
	test('uses room scores for both speed and survival', () => {
		const member: TFATeamMember = {
			id: 'user',
			kc: 100,
			attempts: 200,
			gear: { melee: 80, mage: 80, range: 80, total: 80 }
		};
		const bosses = Object.fromEntries(Object.keys(TFABosses).map(boss => [boss, 80])) as Record<
			keyof typeof TFABosses,
			number
		>;
		const improved = { ...member, gear: { ...member.gear, bosses: { ...bosses, dreadnoth: 100 } } };
		expect(tfaDeathChance(improved, 'dreadnoth', true)).toBeLessThan(tfaDeathChance(member, 'dreadnoth', true));
		expect(tfaRaidDuration([improved], ['dreadnoth'])).toBeLessThan(tfaRaidDuration([member], ['dreadnoth']));
		expect(tfaRaidDuration([improved], ['ocellus'])).toBe(tfaRaidDuration([member], ['ocellus']));
	});

	test('rewards crush accuracy rather than slash accuracy', () => {
		const melee = constructGearSetup({ weapon: 'Zamorakian hasta' });
		const user = {
			gear: {
				melee,
				mage: constructGearSetup({ weapon: 'Kodai wand' }),
				range: constructGearSetup({ '2h': 'Twisted bow' })
			}
		} as unknown as Parameters<typeof calculateTFAGear>[0];
		const baseline = calculateTFAGear(user).melee;
		melee.stats = { ...melee.stats, attack_slash: melee.stats.attack_slash + 100 };
		expect(calculateTFAGear(user).melee).toBe(baseline);
		melee.stats = { ...melee.stats, attack_crush: melee.stats.attack_crush + 100 };
		expect(calculateTFAGear(user).melee).toBeGreaterThan(baseline);
	});

	test('matching elemental tomes improve the relevant rooms', () => {
		const user = {
			gear: {
				melee: constructGearSetup({ weapon: 'Zamorakian hasta' }),
				range: constructGearSetup({ '2h': 'Twisted bow' }),
				mage: constructGearSetup({ weapon: 'Harmonised nightmare staff', shield: 'Tome of fire' })
			}
		} as unknown as Parameters<typeof calculateTFAGear>[0];
		const fire = calculateTFAGear(user);
		user.gear.mage = constructGearSetup({ weapon: 'Harmonised nightmare staff', shield: 'Tome of water' });
		// Keep stats identical so this comparison isolates elemental utility.
		user.gear.mage.stats = {
			...constructGearSetup({ weapon: 'Harmonised nightmare staff', shield: 'Tome of fire' }).stats
		};
		const water = calculateTFAGear(user);
		expect(fire.bosses!.dreadnoth).toBeGreaterThan(water.bosses!.dreadnoth);
		expect(water.bosses!.xarth).toBeGreaterThan(fire.bosses!.xarth);
		expect(fire.bosses!.ocellus).toBe(water.bosses!.ocellus);
	});
});
