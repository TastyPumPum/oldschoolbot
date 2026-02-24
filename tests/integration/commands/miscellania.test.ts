import { describe, expect, it } from 'vitest';

import type { MiscellaniaState } from '../../../src/lib/miscellania/calc.js';
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
		expect(res).toContain('Managing Miscellania preview:');
		expect(res).toContain('Cost if started now: 75,000 GP');
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

	it('starts trip, charges GP and persists state on completion', async () => {
		const user = await createTestUser(undefined, { GP: 500_000 });
		const before = user.GP;
		const { commandResult } = await user.runCmdAndTrip('activities', {
			managing_miscellania: {
				primary_area: 'maple',
				secondary_area: 'herbs'
			}
		});
		expect(commandResult).toContain('is now doing Managing Miscellania (1 day backlog)');
		await user.sync();
		expect(user.GP).toEqual(before - 75_000);
		const stateRes = await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
			select: { miscellania_state: true }
		});
		const state = stateRes.miscellania_state as unknown as MiscellaniaState;
		expect(state.primaryArea).toEqual('maple');
		expect(state.secondaryArea).toEqual('herbs');
		expect(typeof state.lastClaimedAt).toEqual('number');
	});
});
