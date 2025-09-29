import { afterEach, describe, expect, it, vi } from 'vitest';

import type { MUser } from '../../src/lib/MUser.js';
import type { AutoFarmStepData, FarmingActivityTaskOptions } from '../../src/lib/types/minions.js';

const handleTripFinish = vi.fn();
const updateBankSetting = vi.fn();
const userStatsBankUpdate = vi.fn();
const mahojiClientSettingsFetch = vi.fn().mockResolvedValue({
	farming_loot_bank: {}
});
const mahojiClientSettingsUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/skilling/skills/farming/utils/farmingHelpers.js', () => ({
	getFarmingKeyFromName: vi.fn().mockReturnValue('test_patch')
}));

vi.mock('@/lib/util/handleTripFinish.js', () => ({
	handleTripFinish
}));

vi.mock('@/lib/util/updateBankSetting.js', () => ({
	updateBankSetting
}));

vi.mock('@/lib/util/clientSettings.js', () => ({
	mahojiClientSettingsFetch,
	mahojiClientSettingsUpdate
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
	const originalActivityManager = (globalThis as any).ActivityManager;
	const originalPrisma = (globalThis as any).prisma;
	const originalMUserFetch = (globalThis as any).mUserFetch;

	afterEach(() => {
		(globalThis as any).ActivityManager = originalActivityManager;
		(globalThis as any).prisma = originalPrisma;
		(globalThis as any).mUserFetch = originalMUserFetch;
		vi.clearAllMocks();
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
			farmedCrop: { create: createFarmedCrop },
			clientStorage: {
				findFirst: vi.fn().mockResolvedValue(null),
				update: vi.fn().mockResolvedValue(undefined)
			}
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
			perkTier: vi.fn().mockReturnValue(0),
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
		const { Farming } = await import('../../src/lib/skilling/skills/farming/index.js');

		const plant = Farming.Plants.find(p => p.name === 'Guam');
		expect(plant, 'guam plant should exist in farming data').not.toBeNull();
		const plantName = plant!.name;

		const nextStep: AutoFarmStepData = {
			plantsName: plantName,
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
			plantsName: plantName,
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
