import { describe, expect, it } from 'vitest';

import { type MiscellaniaState, simulateDetailedMiscellania } from '../../../src/lib/miscellania/calc.js';
import { createTestUser } from '../util.js';

describe('Managing Miscellania Command', () => {
	it('returns detailed simulation output', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		const res = await user.runCommand('simulate', {
			managing_miscellania: {
				primary_area: 'maple',
				secondary_area: 'herbs',
				detailed: true,
				days: 1,
				royal_trouble: false,
				starting_coffer: 750000,
				starting_favour: 100
			}
		});
		expect(res).toContain('Managing Miscellania detailed simulation:');
		expect(res).toContain('Ending coffer: 700,000');
		expect(res).toContain('GP spent: 50,000');
		expect(res).toContain('Resource points: 600');
	});

	it('returns preview output without charging GP', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		const before = user.GP;
		const res = await user.runCommand('activities', {
			managing_miscellania: {
				primary_area: 'maple',
				secondary_area: 'herbs',
				preview: true
			}
		});
		expect(res).toContain('Managing Miscellania top-up preview:');
		await user.sync();
		expect(user.GP).toEqual(before);
	});

	it('rejects incompatible area pairs', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		const res = await user.runCommand('activities', {
			managing_miscellania: {
				primary_area: 'fishing_raw',
				secondary_area: 'fishing_cooked'
			}
		});
		expect(res).toEqual('Choose either Fishing (Raw) or Fishing (Cooked), not both.');
	});

	it('starts top-up trip and persists state on completion', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		const before = user.GP;
		const { commandResult } = await user.runCmdAndTrip('activities', {
			managing_miscellania: {
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});
		expect(commandResult).toContain('is now doing a Miscellania favour top-up trip');
		await user.sync();
		expect(user.GP).toEqual(before);
		const stateRes = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
			select: { miscellania_state: true }
		});
		const state = stateRes.miscellania_state as unknown as MiscellaniaState;
		expect(state.primaryArea).toEqual('maple');
		expect(state.secondaryArea).toEqual('herbs');
		expect(state.favour).toEqual(100);
	});

	it('claim spends GP based on coffer reduction and resets resource points', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		await user.runCommand('testpotato', {
			miscellania_set: {
				days_ago: 5,
				coffer: 7_500_000,
				favour: 100,
				resource_points: 0,
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});
		const before = user.GP;
		const res = await user.runCommand('activities', {
			managing_miscellania: {
				action: 'claim'
			}
		});
		const content = typeof res === 'string' ? res : ((res as any).content as string);
		expect(content).toContain('You claimed Miscellania resources');
		if (typeof res !== 'string') {
			expect(((res as any).files?.length as number | undefined) ?? 0).toBeGreaterThan(0);
		}
		await user.sync();
		expect(user.GP).toBeLessThan(before);
		expect(user.bank.length).toBeGreaterThan(0);
		const stateRes = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
			select: { miscellania_state: true }
		});
		const state = stateRes.miscellania_state as unknown as MiscellaniaState;
		expect(state.resourcePoints).toEqual(0);
		expect(state.cofferAtLastClaim).toEqual(state.coffer);
	});

	it('caps persisted progression to 100 days even if state is much older', async () => {
		const user = await createTestUser(undefined, { GP: 5_000_000 });
		await user.runCommand('testpotato', {
			miscellania_set: {
				days_ago: 300,
				coffer: 7_500_000,
				favour: 100,
				resource_points: 0,
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});

		await user.runCmdAndTrip('activities', {
			managing_miscellania: {
				action: 'topup',
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});

		const stateRes = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
			select: { miscellania_state: true }
		});
		const state = stateRes.miscellania_state as unknown as MiscellaniaState;
		const expected = simulateDetailedMiscellania({
			days: 100,
			royalTrouble: true,
			startingCoffer: 7_500_000,
			startingFavour: 100,
			constantFavour: false
		});

		expect(state.coffer).toEqual(expected.endingCoffer);
		expect(state.resourcePoints).toEqual(expected.resourcePoints);
		expect(state.favour).toEqual(100);
	});

	it('allows claim while minion is busy', async () => {
		const user = await createTestUser(undefined, { GP: 1_000_000 });
		await user.runCommand('testpotato', {
			miscellania_set: {
				days_ago: 5,
				coffer: 7_500_000,
				favour: 100,
				resource_points: 0,
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});

		const startTopup = await user.runCommand('activities', {
			managing_miscellania: {
				action: 'topup',
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});
		expect(startTopup).toContain('is now doing a Miscellania favour top-up trip');

		const claimWhileBusy = await user.runCommand('activities', {
			managing_miscellania: {
				action: 'claim'
			}
		});
		const claimContent =
			typeof claimWhileBusy === 'string' ? claimWhileBusy : ((claimWhileBusy as any).content as string);
		expect(claimContent).toContain('You claimed Miscellania resources');
		expect(claimContent).not.toContain('is currently busy');
	});

	it('normalizes legacy miscellania state without crashing', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		const oldState = {
			lastClaimedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
			primaryArea: 'maple',
			secondaryArea: 'herbs',
			coffer: 7_500_000,
			favour: 100,
			resourcePoints: 0
		};
		await prisma.user.update({
			where: { id: user.id },
			data: { miscellania_state: oldState as any }
		});

		const res = await user.runCommand('activities', {
			managing_miscellania: {
				action: 'claim',
				preview: true
			}
		});
		expect(res).toContain('Managing Miscellania claim preview:');
	});

	it('blocks topup if already topped up today and favour is 100%', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		await user.runCmdAndTrip('activities', {
			managing_miscellania: {
				action: 'topup',
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});

		const res = await user.runCommand('activities', {
			managing_miscellania: {
				action: 'topup',
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});
		expect(res).toContain('approval is already 100%');
		expect(res).toContain('top-up again in');
	});

	it('blocks claim when there are no resources to claim', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		await user.runCommand('testpotato', {
			miscellania_set: {
				days_ago: 0,
				coffer: 7_500_000,
				favour: 100,
				resource_points: 0,
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});

		const res = await user.runCommand('activities', {
			managing_miscellania: {
				action: 'claim'
			}
		});
		expect(res).toEqual('You have no Miscellania resources to claim right now.');
	});
});
