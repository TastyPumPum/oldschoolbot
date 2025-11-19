import { PerkTier } from '@oldschoolgg/toolkit';
import { EMonster, Monsters } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { MUserClass } from '@/lib/MUser.js';
import { slayerMasters } from '@/lib/slayer/slayerMasters.js';
import { getAssignableSlayerTaskIDs } from '@/lib/slayer/slayerUtil.js';
import { patronMsg } from '@/lib/util/smallUtils.js';
import { slayerCommand } from '@/mahoji/commands/slayer.js';
import { createTestUser, mockClient, mockMathRandom } from '../util.js';

describe('Slayer Tasks', async () => {
	await mockClient();
	expect(Monsters.Man.id).toBe(EMonster.MAN);

	test('Various', async () => {
		const user = await createTestUser();
		mockMathRandom(0.1);
		expect(Math.random()).toEqual(0.1);
		const res: any = await user.runCommand(slayerCommand, { new_task: {} });
		expect(res.content).toContain('has assigned you to kill');

		const res2: any = await user.runCommand(slayerCommand, { new_task: {} });
		expect(res2.content).toContain('You already have a slayer task');
		expect(res2.content).toContain('Your current task');
		expect(Math.random()).toEqual(0.1);
		const res3 = await user.runCommand(slayerCommand, { manage: { command: 'skip' } });
		expect(res3).toContain('You need 30 points to cancel, you only have: 0.');

		await user.update({ slayer_points: 100 });
		const res4 = await user.runCommand(slayerCommand, { manage: { command: 'skip' } });
		expect(res4).toContain('Your task has been skipped. You now have 70 slayer points');

		const res5: any = await user.runCommand(slayerCommand, { new_task: {} });
		expect(res5.content).toContain('has assigned you to kill');
		expect(Math.random()).toEqual(0.1);
		await user.update({ QP: 150 });
		const res6 = await user.runCommand(slayerCommand, { manage: { command: 'block' } });
		expect(res6).toContain('You need 100 points to block, you only have: 70');

		await user.update({ slayer_points: 150 });
		const res7 = await user.runCommand(slayerCommand, { manage: { command: 'block' } });
		expect(res7).toContain('Your task has been blocked. You now have 50 slayer points.');
		await user.sync();
		expect(Math.random()).toEqual(0.1);
		expect(user.user.slayer_blocked_ids).toHaveLength(1);
		expect(user.user.slayer_blocked_ids[0]).toEqual(655);
		expect(user.user.slayer_points).toEqual(50);

		expect(await user.runCommand(slayerCommand, { status: {} })).toContain(
			'You have 50 slayer points, and have completed 0 tasks in a row and 0 wilderness tasks in a row.'
		);

		expect(((await user.runCommand(slayerCommand, { new_task: {} })) as any).content).toContain(
			'has assigned you to kill'
		);

		expect(await user.runCommand(slayerCommand, { status: {} })).toContain(
			'Your current task from Turael is to kill **Birds** (**Alternate Monsters**: Chicken, Duck, Duckling, Mounted terrorbird gnome, Penguin, Rooster, Seagull, Terrorbird). You have 16 kills remaining.'
		);
	});

	test('Patron skip list management', async () => {
		const user = await createTestUser();
		vi.spyOn(MUserClass.prototype, 'fetchPerkTier').mockResolvedValue(PerkTier.Two);

		const addRes = await user.runCommand(slayerCommand, {
			skip_list: { action: 'add', master: 'turael', monster: 'Birds' }
		});
		expect(addRes).toContain("Added Birds to Turael's skip list.");
		expect(user.getSlayerSkipSettings()).toEqual({
			turael: [Monsters.Bird.id]
		});

		const listRes = await user.runCommand(slayerCommand, { skip_list: { action: 'list' } });
		expect(listRes).toContain('Turael: Birds');

		const removeRes = await user.runCommand(slayerCommand, {
			skip_list: { action: 'remove', master: 'turael', monster: 'Birds' }
		});
		expect(removeRes).toBe("Removed Birds from Turael's skip list.");
		expect(user.getSlayerSkipSettings()).toEqual({});

		vi.restoreAllMocks();
	});

	test('Auto-skips tasks when on skip list', async () => {
		const user = await createTestUser();
		vi.spyOn(MUserClass.prototype, 'fetchPerkTier').mockResolvedValue(PerkTier.Two);
		await user.update({ slayer_points: 90 });
		const restoreRandom = mockMathRandom(0.1);

		try {
			await user.runCommand(slayerCommand, {
				skip_list: { action: 'add', master: 'turael', monster: 'Birds' }
			});

			const res: any = await user.runCommand(slayerCommand, { new_task: { master: 'turael' } });
			expect(res.content).toContain('You auto-skipped 1 task(s) and spent 30 Slayer points.');
			expect(res.content).not.toContain('ran out of Slayer points');
			await user.sync();
			expect(user.user.slayer_points).toBe(60);
		} finally {
			restoreRandom();
			vi.restoreAllMocks();
		}
	});

	test('Auto-skip stops when out of points', async () => {
		const user = await createTestUser();
		vi.spyOn(MUserClass.prototype, 'fetchPerkTier').mockResolvedValue(PerkTier.Two);
		await user.update({ slayer_points: 30 });
		const restoreRandom = mockMathRandom(0.1);

		try {
			await user.runCommand(slayerCommand, {
				skip_list: { action: 'add', master: 'turael', monster: 'Birds' }
			});
			await user.runCommand(slayerCommand, {
				skip_list: { action: 'add', master: 'turael', monster: 'Bats' }
			});

			const res: any = await user.runCommand(slayerCommand, { new_task: { master: 'turael' } });
			expect(res.content).toContain('You auto-skipped 1 task(s) and spent 30 Slayer points.');
			expect(res.content).toContain('You ran out of Slayer points, so I stopped skipping.');
			await user.sync();
			expect(user.user.slayer_points).toBe(0);
		} finally {
			restoreRandom();
			vi.restoreAllMocks();
		}
	});

	test('All tasks skipped message', async () => {
		const user = await createTestUser();
		vi.spyOn(MUserClass.prototype, 'fetchPerkTier').mockResolvedValue(PerkTier.Two);
		const turael = slayerMasters.find(m => m.name === 'Turael')!;
		const assignable = getAssignableSlayerTaskIDs(user, turael);
		await user.updateSlayerSkipSettings(turael.aliases[0], assignable);

		const res = await user.runCommand(slayerCommand, { new_task: { master: 'turael' } });
		expect(res).toBe('All tasks for Turael are in your skip list. Remove at least one with /slayer skip_list.');

		vi.restoreAllMocks();
	});

	test('Non-patron cannot use skip list', async () => {
		const user = await createTestUser();
		const res = await user.runCommand(slayerCommand, {
			skip_list: { action: 'add', master: 'turael', monster: 'Birds' }
		});
		expect(res).toBe(patronMsg(PerkTier.Two));
	});
});
