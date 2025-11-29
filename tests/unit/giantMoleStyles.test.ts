import { Bank, convertLVLtoXP, itemID, Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { miscBossKillables } from '@/lib/minions/data/killableMonsters/bosses/misc.js';
import { hasMonsterRequirements } from '@/lib/util/hasMonsterRequirements.js';
import { resolveAvailableItemBoosts } from '@/mahoji/mahojiSettings.js';
import { mockMUser } from './userutil.js';
import { makeGearBank } from './utils.js';

const giantMole = miscBossKillables.find(mon => mon.id === Monsters.GiantMole.id)!;

describe('Giant Mole style handling', () => {
	test('applies style-specific boosts', () => {
		const gearBank = makeGearBank({
			bank: new Bank()
				.add("Tumeken's shadow")
				.add('Occult necklace')
				.add('Imbued saradomin cape')
				.add('Tormented bracelet')
				.add('Magus ring')
				.add('Twisted bow')
				.add('Voidwaker')
		});

		const boosts = resolveAvailableItemBoosts(gearBank, giantMole, false, 'mage');

		expect(boosts.amount(itemID("Tumeken's shadow"))).toBe(15);
		expect(boosts.amount(itemID('Occult necklace'))).toBe(4);
		expect(boosts.amount(itemID('Imbued saradomin cape'))).toBe(3);
		expect(boosts.amount(itemID('Tormented bracelet'))).toBe(3);
		expect(boosts.amount(itemID('Magus ring'))).toBe(3);
		expect(boosts.amount(itemID('Twisted bow'))).toBe(0);
		expect(boosts.amount(itemID('Voidwaker'))).toBe(0);
	});

	test('style-specific requirements', () => {
		const mageUser = mockMUser({
			bank: new Bank(),
			skills_prayer: convertLVLtoXP(50)
		});
		mageUser.user.attack_style = ['magic'] as any;

		const meleeUser = mockMUser({
			bank: new Bank(),
			skills_prayer: convertLVLtoXP(50)
		});
		meleeUser.user.attack_style = ['attack'] as any;

		expect(hasMonsterRequirements(mageUser, giantMole)[0]).toBe(true);

		const meleeResult = hasMonsterRequirements(meleeUser, giantMole);
		expect(meleeResult[0]).toBe(false);
		expect(meleeResult[1]).toContain('Try switching to');
	});
});
