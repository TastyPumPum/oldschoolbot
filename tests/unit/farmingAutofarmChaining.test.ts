import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MUser } from '../../src/lib/MUser.js';
import type { AutoFarmStepData, FarmingActivityTaskOptions } from '../../src/lib/types/minions.js';

const handleTripFinish = vi.fn();
const updateBankSetting = vi.fn();
const userStatsBankUpdate = vi.fn();

const stubPlant = {
	id: 1,
	name: 'Test plant',
	aliases: ['test plant'],
	seedType: 'test',
	plantXp: 10,
	checkXp: 0,
	harvestXp: 0,
	herbXp: undefined,
	herbLvl: undefined,
	inputItems: {},
	outputLogs: undefined,
	outputRoots: undefined,
	givesLogs: false,
	givesCrops: false,
	fixedOutput: false,
	variableYield: false,
	numOfStages: 1,
	chanceOfDeath: 0,
	chance1: 0,
	chance99: 0,
	treeWoodcuttingLevel: undefined,
	needsChopForHarvest: false,
	petChance: 0,
	growthTime: 0,
	timePerPatchTravel: 0,
	timePerHarvest: 0,
	woodcuttingXp: 0,
	canPayFarmer: false,
	canCompostPatch: false,
	canCompostandPay: false
} as const;

vi.mock('@/lib/skilling/skills/farming/index.js', () => ({
	Farming: {
		Plants: [stubPlant],
		calcVariableYield: vi.fn()
	}
}));

vi.mock('@/lib/skilling/skills/farming/utils/farmingHelpers.js', () => ({
	getFarmingKeyFromName: vi.fn().mockReturnValue('test_patch')
}));

vi.mock('@/lib/util/handleTripFinish.js', () => ({
	handleTripFinish
}));

vi.mock('@/lib/util/updateBankSetting.js', () => ({
	updateBankSetting
}));

vi.mock('@/mahoji/mahojiSettings.js', () => ({
	userStatsBankUpdate
}));

vi.mock('@/lib/util.js', () => ({
	skillingPetDropRate: vi.fn().mockReturnValue({ petDropRate: Number.POSITIVE_INFINITY })
}));

vi.mock('@/lib/canvas/chatHeadImage.js', () => ({
	default: vi.fn()
}));

vi.mock('@/lib/combat_achievements/combatAchievements.js', () => ({
	combatAchievementTripEffect: vi.fn()
}));

vi.mock('@/lib/util/logError.js', () => ({
	logError: vi.fn(),
	assert: (condition: unknown, message?: string) => {
		if (!condition) {
			throw new Error(message ?? 'Assertion failed');
		}
	}
}));

vi.mock('@oldschoolgg/rng', () => ({
	randInt: vi.fn().mockReturnValue(0),
	roll: vi.fn().mockReturnValue(false)
}));

describe('auto farm chaining busy check', () => {
	afterEach(() => {
		delete (globalThis as any).ActivityManager;
		delete (globalThis as any).prisma;
		delete (globalThis as any).mUserFetch;
	});

	it('schedules the next step when the finishing activity is the only busy task', async () => {
		const userID = '123';
		const channelID = '789';
		const finishingTaskID = 456;
		const now = Date.now();

		const createdActivity = {
			id: 999,
			user_id: BigInt(userID),
			channel_id: BigInt(channelID),
			finish_date: new Date(now + 1000),
			start_date: new Date(now),
			completed: false,
			type: 'Farming',
			data: {},
			group_activity: false,
			duration: 1000
		};

		const createActivity = vi.fn().mockImplementation(async ({ data }: { data: any }) => ({
			...createdActivity,
			finish_date: data.finish_date,
			start_date: data.start_date,
			user_id: data.user_id,
			channel_id: data.channel_id,
			data: data.data,
			duration: data.duration
		}));

		const createFarmedCrop = vi.fn().mockResolvedValue({ id: 321 });

		(globalThis as any).prisma = {
			activity: { create: createActivity },
			farmedCrop: { create: createFarmedCrop }
		};

		const getActivityOfUser = vi.fn().mockReturnValue({
			id: finishingTaskID,
			type: 'Farming'
		});
		const activitySync = vi.fn();

		(globalThis as any).ActivityManager = {
			getActivityOfUser,
			activitySync
		};

		const user = {
			id: userID,
			user: { completed_ca_task_ids: [] },
			toString: () => 'TestUser',
			minionName: 'Test Minion',
			skillsAsLevels: { farming: 99, woodcutting: 99 },
			skillsAsXP: { farming: 13_000_000, woodcutting: 13_000_000 },
			bitfield: [] as number[],
			hasEquippedOrInBank: vi.fn().mockReturnValue(false),
			hasEquipped: vi.fn().mockReturnValue(false),
			gear: {
				melee: { hasEquipped: vi.fn().mockReturnValue(false) },
				range: { hasEquipped: vi.fn().mockReturnValue(false) },
				mage: { hasEquipped: vi.fn().mockReturnValue(false) }
			},
			bank: { clone: () => ({}) },
			cl: { clone: () => ({}) },
			addXP: vi.fn().mockResolvedValue('xp gained'),
			addItemsToCollectionLog: vi.fn().mockResolvedValue(undefined),
			transactItems: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
			farmingContract: vi.fn().mockReturnValue({
				contract: {
					plantsContract: null,
					seedType: null,
					quantity: 0,
					contractsCompleted: 0
				}
			})
		} as unknown as MUser;

		(globalThis as any).mUserFetch = vi.fn().mockResolvedValue(user);

		const { farmingTask } = await import('../../src/tasks/minions/farmingActivity.js');

		const nextStep: AutoFarmStepData = {
			plantsName: 'Test plant',
			quantity: 1,
			upgradeType: null,
			payment: false,
			treeChopFeePaid: 0,
			treeChopFeePlanned: 0,
			patchType: {
				lastPlanted: null,
				patchPlanted: false,
				plantTime: now,
				lastQuantity: 0,
				lastUpgradeType: null,
				lastPayment: false,
				pid: undefined
			},
			planting: true,
			currentDate: now,
			duration: 1000
		};

		const data: FarmingActivityTaskOptions = {
			type: 'Farming',
			id: finishingTaskID,
			finishDate: now,
			userID,
			channelID,
			duration: 1000,
			plantsName: 'Test plant',
			quantity: 1,
			upgradeType: null,
			payment: false,
			treeChopFeePaid: 0,
			treeChopFeePlanned: 0,
			patchType: {
				lastPlanted: null,
				patchPlanted: false,
				plantTime: now,
				lastQuantity: 0,
				lastUpgradeType: null,
				lastPayment: false,
				pid: undefined
			},
			planting: true,
			currentDate: now,
			autoFarmed: true,
			autoFarmPlan: [nextStep]
		};

		const runPromise =
			'isNew' in farmingTask ? farmingTask.run(data, { user, handleTripFinish }) : farmingTask.run(data);

		await expect(runPromise).resolves.toBeUndefined();

		expect(createActivity).toHaveBeenCalledOnce();
		expect(getActivityOfUser).toHaveBeenCalledOnce();
		expect(activitySync).toHaveBeenCalledOnce();
	});
});
