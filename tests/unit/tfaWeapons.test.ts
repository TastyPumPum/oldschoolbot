import { Items, itemID } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { checkUserCanUseDegradeableItem } from '@/lib/degradeableItems.js';
import { checkRangeGearWeapon } from '@/lib/gear/functions/checkRangeGearWeapon.js';
import { projectiles } from '@/lib/gear/projectiles.js';
import { degradeableItemsCommand } from '@/lib/minions/functions/degradeableItemsCommand.js';
import { constructGearSetup } from '@/lib/structures/Gear.js';

describe('TFA weapon charges', () => {
	test('checks the new charge counters before consuming them', () => {
		const user = { usernameOrMention: 'User', user: { obligator_charges: 249, zorya_tome_charges: 250 } } as MUser;
		expect(
			checkUserCanUseDegradeableItem({ item: Items.getOrThrow('Obligator (base)'), chargesToDegrade: 250, user })
				.hasEnough
		).toBe(false);
		expect(
			checkUserCanUseDegradeableItem({ item: Items.getOrThrow("Zorya's tome"), chargesToDegrade: 250, user })
				.hasEnough
		).toBe(true);
	});

	test('enforces Obligator capacity using ten charges per batch', async () => {
		const user = { user: { obligator_charges: 19_990 }, owns: () => false } as unknown as MUser;
		const overCapacity = await degradeableItemsCommand({} as MInteraction, user, 'obligator', 2, undefined);
		expect(overCapacity).toContain('at most 20,000 charges');
		const withinCapacity = await degradeableItemsCommand({} as MInteraction, user, 'obligator', 1, undefined);
		expect(withinCapacity).toContain("You don't own");
	});

	test('enforces the tome capacity using one charge per batch', async () => {
		const user = { user: { zorya_tome_charges: 19_999 }, owns: () => false } as unknown as MUser;
		expect(await degradeableItemsCommand({} as MInteraction, user, "Zorya's tome", 2, undefined)).toContain(
			'at most 20,000 charges'
		);
	});
});

describe('Ascension ammunition', () => {
	test('accepts every Ascension bolt variant and recognises Ava saving', () => {
		expect(projectiles.ascensionBolt.savedByAvas).toBe(true);
		for (const ammo of projectiles.ascensionBolt.items) {
			const gear = constructGearSetup({ '2h': 'Ascension crossbows', ammo: Items.getOrThrow(ammo).name });
			expect(checkRangeGearWeapon(gear)).toMatchObject({
				weapon: { id: itemID('Ascension crossbows') },
				ammo: { item: ammo }
			});
		}
	});

	test('rejects ordinary bolts in Ascension crossbows and Ascension bolts in ordinary crossbows', () => {
		expect(
			typeof checkRangeGearWeapon(
				constructGearSetup({ '2h': 'Ascension crossbows', ammo: 'Ruby dragon bolts (e)' })
			)
		).toBe('string');
		expect(
			typeof checkRangeGearWeapon(
				constructGearSetup({ weapon: 'Zaryte crossbow', ammo: 'Diamond ascension bolts (e)' })
			)
		).toBe('string');
	});
});
