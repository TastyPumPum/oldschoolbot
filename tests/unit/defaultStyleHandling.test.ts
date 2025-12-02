import { Bank, convertLVLtoXP, itemID, Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { miscBossKillables } from '@/lib/minions/data/killableMonsters/bosses/misc.js';
import { hasMonsterRequirements } from '@/lib/util/hasMonsterRequirements.js';
import { resolveAvailableItemBoosts } from '@/mahoji/mahojiSettings.js';
import { mockMUser } from './userutil.js';
import { makeGearBank } from './utils.js';

const giantMole = miscBossKillables.find(mon => mon.id === Monsters.GiantMole.id)!;

describe('Default attack style handling', () => {
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

		expect(boosts.amount(itemID("Tumeken's shadow"))).toBe(13);
		expect(boosts.amount(itemID('Occult necklace'))).toBe(2);
		expect(boosts.amount(itemID('Imbued saradomin cape'))).toBe(2);
		expect(boosts.amount(itemID('Tormented bracelet'))).toBe(2);
		expect(boosts.amount(itemID('Magus ring'))).toBe(2);
		expect(boosts.amount(itemID('Twisted bow'))).toBe(0);
		expect(boosts.amount(itemID('Voidwaker'))).toBe(0);
	});

	test('style-specific requirements', () => {
		const baseBank = new Bank().add('Prayer potion(4)', 10);

		const mageUser = mockMUser({
			bank: baseBank.clone(),
			skills_prayer: convertLVLtoXP(50)
		});
		mageUser.user.attack_style = ['magic'] as any;

		const meleeUser = mockMUser({
			bank: baseBank.clone(),
			skills_prayer: convertLVLtoXP(50)
		});
		meleeUser.user.attack_style = ['attack'] as any;

		expect(hasMonsterRequirements(mageUser, giantMole)[0]).toBe(true);

		const meleeResult = hasMonsterRequirements(meleeUser, giantMole);
		expect(meleeResult[0]).toBe(false);
		expect(meleeResult[1]).toContain('Try switching to');
	});
});
