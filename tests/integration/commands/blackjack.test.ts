import { gambleCommand } from '@/mahoji/commands/gamble';
import { Bank } from 'oldschooljs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createTestUser, mockClient, mockInteraction } from '../util';

describe('Blackjack Command', async () => {
	const client = await mockClient();
	const user = await createTestUser();

	beforeEach(async () => {
		await user.reset();
		await client.reset();
		await user.addItemsToBank({ items: new Bank().add('Coins', 10_000_000) });
	});

	test('Side bet pair', async () => {
		vi.spyOn(require('e'), 'shuffleArr').mockImplementation((...args: unknown[]) => args[0]);
		const utilToolkit = await import('@oldschoolgg/toolkit/util');
		vi.spyOn(utilToolkit, 'awaitMessageComponentInteraction').mockResolvedValue({
			customId: 'STAND',
			...mockInteraction({ userId: user.id })
		} as any);

		const result = await user.runCommand(gambleCommand, {
			blackjack: { amount: '100k', sidebet: '100k' }
		});

		expect(result).toContain('Side bet won');
		await user.statsMatch('gp_blackjack', BigInt(900_000));
	});
});
