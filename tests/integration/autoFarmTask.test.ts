import type { RNGProvider } from '@oldschoolgg/rng';
import { Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import './setup.js';

import type { IPatchData } from '../../src/lib/skilling/skills/farming/utils/types.js';
import type { AutoFarmStepData, FarmingActivityTaskOptions } from '../../src/lib/types/minions.js';
import * as addSubTaskModule from '../../src/lib/util/addSubTaskToActivityTask.js';
import * as handleTripFinishModule from '../../src/lib/util/handleTripFinish.js';
import { farmingTask } from '../../src/tasks/minions/farmingActivity.js';
import * as farmingStepModule from '../../src/tasks/minions/farmingStep.js';
import { createTestUser, mockClient, TEST_CHANNEL_ID } from './util.js';

vi.mock('../../src/lib/util/webhook', () => ({
	sendToChannelID: vi.fn()
}));

describe('farming task auto farm sequencing', () => {
	beforeEach(async () => {
		await mockClient();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	async function runAutoFarmScenario() {
		const user = await createTestUser();

		const basePatch: IPatchData = {
			lastPlanted: 'Guam',
			patchPlanted: true,
			plantTime: Date.now(),
			lastQuantity: 4,
			lastUpgradeType: null,
			lastPayment: true
		};

		const plan: AutoFarmStepData[] = [
			{
				plantsName: 'Guam',
				quantity: 4,
				upgradeType: null,
				payment: true,
				treeChopFeePaid: 0,
				treeChopFeePlanned: 0,
				patchType: basePatch,
				planting: true,
				currentDate: Date.now(),
				duration: Time.Minute
			},
			{
				plantsName: 'Watermelon',
				quantity: 8,
				upgradeType: null,
				payment: false,
				treeChopFeePaid: 0,
				treeChopFeePlanned: 0,
				patchType: basePatch,
				planting: false,
				currentDate: Date.now() + Time.Minute,
				duration: Time.Minute
			}
		];

		const summaries = [
			{
				planted: { itemName: 'Guam seed', quantity: 4 },
				duration: Time.Minute,
				xp: {
					totalFarming: 100,
					woodcutting: 0,
					herblore: 0,
					planting: 0,
					harvest: 0,
					checkHealth: 0,
					rake: 0,
					bonus: 0
				},
				xpMessages: { farming: 'You received 50 XP\nTake care of your plants.' },
				boosts: ['Graceful'],
				contractCompleted: true,
				payNote: 'Paid 3x Tomatoes to keep the farmers happy.'
			},
			{
				harvested: { itemName: 'Watermelon', quantity: 8, alive: 8, died: 0 },
				duration: Time.Minute,
				xp: {
					totalFarming: 200,
					woodcutting: 100,
					herblore: 50,
					planting: 0,
					harvest: 0,
					checkHealth: 0,
					rake: 0,
					bonus: 0
				},
				xpMessages: { herblore: 'You received 25 XP', woodcutting: 'Keep chopping!' },
				boosts: ['Graceful']
			}
		];

		const results = [
			{
				message: 'First step complete',
				loot: new Bank().add('Seed pack', 1),
				summary: summaries[0]
			},
			{
				message: 'Second step complete',
				loot: new Bank().add('Watermelon', 8),
				summary: summaries[1]
			}
		];

		const executeSpy = vi.spyOn(farmingStepModule, 'executeFarmingStep').mockImplementation(async () => {
			const result = results.shift();
			if (!result) {
				throw new Error('No farming step result available');
			}
			return result;
		});

		const handleTripFinishSpy = vi.spyOn(handleTripFinishModule, 'handleTripFinish').mockResolvedValue();
		const addSubTaskSpy = vi.spyOn(addSubTaskModule, 'default').mockResolvedValue();

		const taskData: FarmingActivityTaskOptions = {
			type: 'Farming',
			userID: user.id,
			channelId: TEST_CHANNEL_ID,
			id: 123,
			finishDate: Date.now(),
			plantsName: plan[0].plantsName,
			patchType: basePatch,
			quantity: plan[0].quantity,
			upgradeType: plan[0].upgradeType,
			payment: plan[0].payment,
			treeChopFeePaid: plan[0].treeChopFeePaid,
			treeChopFeePlanned: plan[0].treeChopFeePlanned,
			planting: plan[0].planting,
			duration: plan[0].duration,
			currentDate: plan[0].currentDate,
			autoFarmed: true,
			autoFarmPlan: plan.slice(1),
			autoFarmCombined: false
		};

		const runOptions: {
			user: typeof user;
			handleTripFinish: typeof handleTripFinishModule.handleTripFinish;
			rng: RNGProvider;
		} = {
			user,
			handleTripFinish: handleTripFinishModule.handleTripFinish,
			rng: {
				roll: () => false,
				randInt: () => 0,
				randFloat: () => 0,
				rand: () => 0,
				shuffle: <T>(array: T[]) => array,
				pick: <T>(array: T[]) => array[0],
				percentChance: () => false
			}
		};

		await farmingTask.run(taskData, runOptions);

		const nextTaskArgs = addSubTaskSpy.mock.calls[0]?.[0] as FarmingActivityTaskOptions | undefined;
		if (!nextTaskArgs) {
			throw new Error('auto farm did not schedule the next patch.');
		}

		const followUpTask: FarmingActivityTaskOptions = {
			...nextTaskArgs,
			id: 456,
			finishDate: Date.now(),
			userID: user.id,
			type: 'Farming'
		};
		await farmingTask.run(followUpTask, runOptions);

		return {
			user,
			executeSpy,
			handleTripFinishSpy,
			addSubTaskSpy
		};
	}

	it('processes multiple auto farm patches sequentially', async () => {
		const { user, executeSpy, handleTripFinishSpy, addSubTaskSpy } = await runAutoFarmScenario();

		expect(executeSpy).toHaveBeenCalledTimes(2);
		expect(handleTripFinishSpy).toHaveBeenCalledTimes(2);
		expect(addSubTaskSpy).toHaveBeenCalledTimes(1);

		const firstCallData = executeSpy.mock.calls[0]?.[0]?.data as FarmingActivityTaskOptions | undefined;
		const secondCallData = executeSpy.mock.calls[1]?.[0]?.data as FarmingActivityTaskOptions | undefined;

		expect(firstCallData?.plantsName).toBe('Guam');
		expect(firstCallData?.patchType.lastPlanted).toBe('Guam');

		expect(secondCallData?.plantsName).toBe('Watermelon');
		expect(secondCallData?.patchType.lastPlanted).toBe('Guam');

		const nextTaskArgs = addSubTaskSpy.mock.calls[0]?.[0] as FarmingActivityTaskOptions | undefined;
		expect(nextTaskArgs?.autoFarmPlan).toEqual([]);
		expect(nextTaskArgs?.duration).toBe(Time.Minute);

		expect(user.minionName).toBeDefined();
	});

	it('queues follow-up steps even when auto contract unlocks are pending', async () => {
		const { addSubTaskSpy } = await runAutoFarmScenario();

		expect(addSubTaskSpy).toHaveBeenCalledTimes(1);
	});
});
