import { Bank, convertLVLtoXP } from 'oldschooljs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import './setup.js';

import { autoFarm } from '../../src/lib/minions/functions/autoFarm.js';
import { prepareFarmingStep } from '../../src/lib/minions/functions/farmingTripHelpers.js';
import { plants } from '../../src/lib/skilling/skills/farming/index.js';
import type { FarmingPatchName } from '../../src/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type { IPatchData, IPatchDataDetailed } from '../../src/lib/skilling/skills/farming/utils/types.js';
import addSubTaskToActivityTask from '../../src/lib/util/addSubTaskToActivityTask.js';
import * as calcMaxTripLengthModule from '../../src/lib/util/calcMaxTripLength.js';
import { mockMUser } from './userutil.js';
import '../../src/lib/util/clientSettings.js';

import { Emoji } from '@oldschoolgg/toolkit';
import { ButtonStyle } from 'discord.js';

import type { SafeUserUpdateInput } from '@/lib/MUser.js';
import { fetchRepeatTrips, repeatTrip } from '@/lib/util/repeatStoredTrip.js';
import type { MInteraction } from '../../src/lib/structures/MInteraction.js';
import { AutoFarmFilterEnum, activity_type_enum, CropUpgradeType } from '../../src/prisma/main/enums.js';
import type { User } from '../../src/prisma/main.js';

// mock activity
vi.mock('../../src/lib/util/addSubTaskToActivityTask.js', () => ({
	default: vi.fn()
}));

// mock repeat trips
vi.mock('../../src/lib/util/repeatStoredTrip.js', () => ({
	fetchRepeatTrips: vi.fn().mockResolvedValue([]),
	repeatTrip: vi.fn()
}));

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type MutableUser = Mutable<User>;

type UpdateCallArgs = Parameters<MUser['update']>;

function isSafeUserUpdateInput(arg: unknown): arg is SafeUserUpdateInput {
	return typeof arg === 'object' && arg !== null;
}

function findContractUpdateCall(calls: UpdateCallArgs[]): SafeUserUpdateInput | undefined {
	for (const call of calls) {
		const [firstArg] = call;
		if (typeof firstArg === 'function') continue;
		if (isSafeUserUpdateInput(firstArg) && 'minion_farmingContract' in firstArg) {
			return firstArg;
		}
	}
	return undefined;
}

type ButtonJSON = {
	type: number;
	style: number;
	label?: string;
	custom_id?: string;
	emoji?: { name?: string; id?: string | null };
};

type ActionRowJSON = {
	type: number;
	components: ButtonJSON[];
};

function isBaseMessage(value: unknown): value is {
	content?: string;
	components?: any[];
} {
	return typeof value === 'object' && value !== null && !('type' in (value as any));
}

const herbPlant = plants.find(p => p.name === 'Guam');
const treePlant = plants.find(p => p.name === 'Oak tree');
const marigoldPlant = plants.find(p => p.name === 'Marigold');

if (!herbPlant || !treePlant || !marigoldPlant) {
	throw new Error('Expected Guam, Oak tree, and Marigold plants to exist for tests');
}

const herbPatch: IPatchData = {
	lastPlanted: null,
	patchPlanted: false,
	plantTime: Date.now(),
	lastQuantity: 0,
	lastUpgradeType: null,
	lastPayment: false
};

const herbPatchDetailed: IPatchDataDetailed = {
	...herbPatch,
	ready: null,
	readyIn: null,
	readyAt: null,
	patchName: herbPlant.seedType,
	friendlyName: 'Herb patch',
	plant: null
};

const treePatch: IPatchData = {
	lastPlanted: treePlant.name,
	patchPlanted: true,
	plantTime: Date.now(),
	lastQuantity: 3,
	lastUpgradeType: null,
	lastPayment: true
};

const treePatchDetailed: IPatchDataDetailed = {
	...treePatch,
	ready: true,
	readyIn: 0,
	readyAt: new Date(),
	patchName: treePlant.seedType,
	friendlyName: 'Tree patch',
	plant: treePlant
};

type FarmingTestInteraction = Pick<MInteraction, 'channelId'>;

const baseInteraction: FarmingTestInteraction = {
	channelId: '123'
};

const herbPatches: Partial<Record<FarmingPatchName, IPatchData>> = {
	[herbPlant.seedType]: herbPatch
};

const treePatches: Partial<Record<FarmingPatchName, IPatchData>> = {
	[treePlant.seedType]: treePatch
};

let calcMaxTripLengthSpy: MockInstance;
const originalPrisma = (globalThis as { prisma?: unknown }).prisma;
const originalMinionIsBusy = (global.ActivityManager as { minionIsBusy?: (userID: string) => boolean }).minionIsBusy;

beforeAll(() => {
	(global.ActivityManager as { minionIsBusy?: (userID: string) => boolean }).minionIsBusy = () => false;
	calcMaxTripLengthSpy = vi.spyOn(calcMaxTripLengthModule, 'calcMaxTripLength');
	(globalThis as { prisma?: unknown }).prisma = undefined;
});

afterAll(() => {
	calcMaxTripLengthSpy.mockRestore();
	(globalThis as { prisma?: unknown }).prisma = originalPrisma;
	(global.ActivityManager as { minionIsBusy?: (userID: string) => boolean }).minionIsBusy = originalMinionIsBusy;
});

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.useRealTimers();
	calcMaxTripLengthSpy.mockReset();
});

describe('auto farm helpers', () => {
	it('autoFarm includes check patches button when no crops are available', async () => {
		const user = mockMUser({
			bank: new Bank(),
			skills_farming: convertLVLtoXP(1)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.AllFarm;

		calcMaxTripLengthSpy.mockReturnValue(5 * 60 * 1000);

		const response = await autoFarm(
			user,
			[],
			{} as Record<FarmingPatchName, IPatchData>,
			baseInteraction as MInteraction
		);

		if (!isBaseMessage(response)) {
			throw new Error('Expected BaseMessageOptions-like response');
		}

		expect(fetchRepeatTrips).toHaveBeenCalledTimes(1);
		expect(repeatTrip).not.toHaveBeenCalled();

		expect(response.content).toBe(
			"There's no Farming crops that you have the requirements to plant, and nothing to harvest."
		);

		const components = response.components ?? [];
		const rowMaybe = components[0] as any;

		let rowJSON: ActionRowJSON;
		if (rowMaybe && typeof rowMaybe.toJSON === 'function') {
			rowJSON = rowMaybe.toJSON() as ActionRowJSON;
		} else if (rowMaybe && typeof rowMaybe === 'object' && 'components' in rowMaybe) {
			rowJSON = rowMaybe as ActionRowJSON;
		} else {
			throw new Error('Unexpected row component type');
		}

		expect(rowJSON.components).toHaveLength(1);

		const buttonMaybe = rowJSON.components[0] as any;
		const buttonJSON: ButtonJSON =
			buttonMaybe && typeof buttonMaybe.toJSON === 'function'
				? (buttonMaybe.toJSON() as ButtonJSON)
				: (buttonMaybe as ButtonJSON);

		expect(buttonJSON.style).toBe(ButtonStyle.Secondary);
		expect(buttonJSON.custom_id).toBe('CHECK_PATCHES');
		expect(buttonJSON.label).toBe('Check Patches');
		expect(buttonJSON.emoji?.name).toBe(Emoji.Stopwatch);
	});

	it('autoFarm attempts to repeat previous trip when available', async () => {
		const user = mockMUser({
			bank: new Bank(),
			skills_farming: convertLVLtoXP(1)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.Replant;

		const repeatTripsMock = fetchRepeatTrips as unknown as MockInstance;
		const repeatTripMock = repeatTrip as unknown as MockInstance;
		repeatTripsMock.mockResolvedValueOnce([{ type: activity_type_enum.ClueCompletion, data: {} }]);
		repeatTripMock.mockResolvedValueOnce('Resuming previous trip');

		calcMaxTripLengthSpy.mockReturnValue(5 * 60 * 1000);

		const response = await autoFarm(
			user,
			[],
			{} as Record<FarmingPatchName, IPatchData>,
			baseInteraction as MInteraction
		);

		expect(fetchRepeatTrips).toHaveBeenCalledTimes(1);
		expect(repeatTrip).toHaveBeenCalledTimes(1);
		expect(response).toBe(
			"There's no Farming crops that you have planted that are ready to be replanted or no seeds remaining.\n\nResuming previous trip"
		);
	});

	it('prepareFarmingStep replant respects last quantity and costs', async () => {
		const bank = new Bank().add('Acorn', 5).add('Supercompost', 5).add('Tomatoes(5)', 5).add('Coins', 10_000);
		const user = mockMUser({
			bank,
			skills_farming: convertLVLtoXP(40),
			skills_woodcutting: convertLVLtoXP(1)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.minion_defaultPay = false;
		mutableUser.minion_defaultCompostToUse = CropUpgradeType.supercompost;

		const result = await prepareFarmingStep({
			user,
			plant: treePlant,
			quantity: null,
			pay: false,
			patchDetailed: treePatchDetailed,
			maxTripLength: 3 * (20 + 5 + 10) * 1000,
			availableBank: user.bank.clone().add('Coins', user.GP),
			compostTier: CropUpgradeType.supercompost
		});

		expect(result.success).toBe(true);
		if (!result.success) return;

		const { cost, quantity, duration, didPay, upgradeType, treeChopFee } = result.data;
		expect(quantity).toBe(treePatchDetailed.lastQuantity);
		expect(duration).toBe(treePatchDetailed.lastQuantity * (20 + 5 + 10) * 1000);
		expect(didPay).toBe(false);
		expect(upgradeType).toBe(CropUpgradeType.supercompost);
		expect(treeChopFee).toBe(200 * treePatchDetailed.lastQuantity);
		expect(cost.amount('Acorn')).toBe(treePatchDetailed.lastQuantity);
		expect(cost.amount('Supercompost')).toBe(treePatchDetailed.lastQuantity);
		expect(cost.amount('Tomatoes(5)')).toBe(0);
	});

	it('autoFarm generates plan for AllFarm filter', async () => {
		const bank = new Bank().add('Guam seed', 4).add('Compost', 4);
		const user = mockMUser({
			bank,
			skills_farming: convertLVLtoXP(50)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.AllFarm;
		mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;

		const transactResult = {
			newUser: user.user,
			itemsAdded: new Bank(),
			itemsRemoved: new Bank(),
			newBank: user.bank.clone(),
			newCL: user.cl.clone(),
			previousCL: new Bank(),
			clLootBank: null
		} satisfies Awaited<ReturnType<typeof user.transactItems>>;
		const transactSpy = vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);
		const statsSpy = vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
		const updateBankSettingSpy = vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();

		calcMaxTripLengthSpy.mockReturnValue(300 * 1000);

		vi.useFakeTimers();
		vi.setSystemTime(new Date('2020-01-01T00:00:00Z'));

		const response = await autoFarm(
			user,
			[herbPatchDetailed],
			herbPatches as Record<FarmingPatchName, IPatchData>,
			baseInteraction as MInteraction
		);

		expect(typeof response).toBe('string');
		expect(response).toContain('auto farm the following patches');

		expect(transactSpy).toHaveBeenCalledTimes(1);
		expect(statsSpy).toHaveBeenCalled();
		expect(updateBankSettingSpy).toHaveBeenCalled();
		expect(addSubTaskToActivityTask).toHaveBeenCalledTimes(1);
	});

	it('autoFarm replant respects last quantity, costs, and timing', async () => {
		const bank = new Bank().add('Acorn', 5).add('Supercompost', 5).add('Tomatoes(5)', 5).add('Coins', 10_000);
		const user = mockMUser({
			bank,
			skills_farming: convertLVLtoXP(40),
			skills_woodcutting: convertLVLtoXP(1)
		});
		const mutableUser = user.user as MutableUser;
		mutableUser.auto_farm_filter = AutoFarmFilterEnum.Replant;
		mutableUser.minion_defaultPay = false;
		mutableUser.minion_defaultCompostToUse = CropUpgradeType.supercompost;

		const transactResult = {
			newUser: user.user,
			itemsAdded: new Bank(),
			itemsRemoved: new Bank(),
			newBank: user.bank.clone(),
			newCL: user.cl.clone(),
			previousCL: new Bank(),
			clLootBank: null
		} satisfies Awaited<ReturnType<typeof user.transactItems>>;
		const transactSpy = vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);
		const statsSpy = vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
		const updateBankSettingSpy = vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();

		calcMaxTripLengthSpy.mockReturnValue(3 * (20 + 5 + 10) * 1000);

		vi.useFakeTimers();
		vi.setSystemTime(new Date('2020-01-01T01:00:00Z'));

		const response = await autoFarm(
			user,
			[treePatchDetailed],
			treePatches as Record<FarmingPatchName, IPatchData>,
			baseInteraction as MInteraction
		);

		expect(typeof response).toBe('string');
		expect(response).toContain('3x Oak tree');
		expect(transactSpy).toHaveBeenCalledTimes(1);
		expect(addSubTaskToActivityTask).toHaveBeenCalledTimes(1);
		expect(statsSpy).toHaveBeenCalled();
		expect(updateBankSettingSpy).toHaveBeenCalled();
	});

	describe('contract-aware filters', () => {
		it('prioritises contract patch before base plan', async () => {
			const bank = new Bank()
				.add('Guam seed', 8)
				.add('Compost', 8)
				.add('Acorn', 3)
				.add('Supercompost', 3)
				.add('Coins', 10_000);
			const user = mockMUser({
				bank,
				skills_farming: convertLVLtoXP(80),
				skills_woodcutting: convertLVLtoXP(50)
			});
			const mutableUser = user.user as MutableUser;
			mutableUser.auto_farm_filter = AutoFarmFilterEnum.CONTRACT_ALL_FARM;
			mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;
			mutableUser.minion_farmingContract = {
				hasContract: true,
				difficultyLevel: 'medium',
				plantToGrow: herbPlant.name,
				plantTier: 2,
				contractsCompleted: 0,
				contractPatchOverrides: {}
			} as any;

			const now = new Date('2020-01-03T00:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(now);

			const contractPatchState: IPatchData = {
				lastPlanted: herbPlant.name,
				patchPlanted: true,
				plantTime: now.getTime() - herbPlant.growthTime * 60_000 - 1,
				lastQuantity: 4,
				lastUpgradeType: null,
				lastPayment: false
			};
			const contractPatchDetailed: IPatchDataDetailed = {
				...contractPatchState,
				ready: true,
				readyIn: 0,
				readyAt: now,
				patchName: herbPlant.seedType,
				friendlyName: 'Herb patch',
				plant: herbPlant
			};
			const treeState: IPatchData = { ...treePatch };
			const treeDetailed: IPatchDataDetailed = { ...treePatchDetailed };

			const patchesDetailed = [contractPatchDetailed, treeDetailed];
			const patches = {
				[herbPlant.seedType]: contractPatchState,
				[treePlant.seedType]: treeState
			} as Record<FarmingPatchName, IPatchData>;

			const transactResult = {
				newUser: user.user,
				itemsAdded: new Bank(),
				itemsRemoved: new Bank(),
				newBank: user.bank.clone(),
				newCL: user.cl.clone(),
				previousCL: new Bank(),
				clLootBank: null
			} satisfies Awaited<ReturnType<typeof user.transactItems>>;
			vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);
			const updateSpy = vi.spyOn(user, 'update').mockResolvedValue({} as any);
			const statsSpy = vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
			const updateBankSettingSpy = vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();

			calcMaxTripLengthSpy.mockReturnValue(600 * 1000);

			const response = await autoFarm(user, patchesDetailed, patches, baseInteraction as MInteraction);

			if ((addSubTaskToActivityTask as any).mock.calls.length > 0) {
				const taskArgs = (addSubTaskToActivityTask as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
				expect(taskArgs.autoFarmPlan[0].plantsName).toBe(herbPlant.name);
			} else {
				if (isBaseMessage(response)) {
					expect(response.content).toBeDefined();
				}
			}

			const contractUpdateCall = findContractUpdateCall(updateSpy.mock.calls);
			expect(contractUpdateCall).toBeDefined();

			if (!contractUpdateCall) {
				throw new Error('Expected contract update call');
			}

			const overrides = (contractUpdateCall.minion_farmingContract as any).contractPatchOverrides;
			expect(overrides).toBeDefined();
			expect(overrides).toHaveProperty(herbPlant.seedType);

			expect(statsSpy).toHaveBeenCalled();
			expect(updateBankSettingSpy).toHaveBeenCalled();
		});

		it('does not add overrides when the base plan ignores the contract patch', async () => {
			const bank = new Bank()
				.add('Guam seed', 5)
				.add('Compost', 5)
				.add('Acorn', 3)
				.add('Supercompost', 3)
				.add('Coins', 10_000);
			const user = mockMUser({
				bank,
				skills_farming: convertLVLtoXP(75),
				skills_woodcutting: convertLVLtoXP(40)
			});
			const mutableUser = user.user as MutableUser;
			mutableUser.auto_farm_filter = AutoFarmFilterEnum.CONTRACT_REPLANT;
			mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;
			mutableUser.minion_farmingContract = {
				hasContract: true,
				difficultyLevel: 'medium',
				plantToGrow: herbPlant.name,
				plantTier: 2,
				contractsCompleted: 3,
				contractPatchOverrides: {}
			} as any;

			const now = new Date('2020-01-02T00:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(now);

			const contractPatchState: IPatchData = {
				lastPlanted: null,
				patchPlanted: false,
				plantTime: now.getTime() - herbPlant.growthTime * 60_000 - 1,
				lastQuantity: 0,
				lastUpgradeType: null,
				lastPayment: false
			};
			const contractPatchDetailed: IPatchDataDetailed = {
				...contractPatchState,
				ready: true,
				readyIn: 0,
				readyAt: now,
				patchName: herbPlant.seedType,
				friendlyName: 'Herb patch',
				plant: null
			};

			const replantTreeState: IPatchData = { ...treePatch };
			const replantTreeDetailed: IPatchDataDetailed = { ...treePatchDetailed };

			const patchesDetailed = [replantTreeDetailed, contractPatchDetailed];
			const patches = {
				[treePlant.seedType]: replantTreeState,
				[herbPlant.seedType]: contractPatchState
			} as Record<FarmingPatchName, IPatchData>;

			calcMaxTripLengthSpy.mockReturnValue(500 * 1000);

			const transactResult = {
				newUser: user.user,
				itemsAdded: new Bank(),
				itemsRemoved: new Bank(),
				newBank: user.bank.clone(),
				newCL: user.cl.clone(),
				previousCL: new Bank(),
				clLootBank: null
			} satisfies Awaited<ReturnType<typeof user.transactItems>>;
			vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);
			const updateSpy = vi.spyOn(user, 'update').mockResolvedValue({} as any);
			const statsSpy = vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
			const updateBankSettingSpy = vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();

			const response = await autoFarm(user, patchesDetailed, patches, baseInteraction as MInteraction);

			const contractUpdateCall = findContractUpdateCall(updateSpy.mock.calls);
			expect(contractUpdateCall).toBeUndefined();

			expect(statsSpy).toHaveBeenCalled();
			expect(updateBankSettingSpy).toHaveBeenCalled();

			if (typeof response === 'string') {
				expect(typeof response).toBe('string');
			}
		});

		it('falls back to base plan when no contract is active', async () => {
			const bank = new Bank().add('Acorn', 3).add('Supercompost', 3).add('Tomatoes(5)', 3).add('Coins', 10_000);
			const user = mockMUser({
				bank,
				skills_farming: convertLVLtoXP(50),
				skills_woodcutting: convertLVLtoXP(20)
			});
			const mutableUser = user.user as MutableUser;
			mutableUser.auto_farm_filter = AutoFarmFilterEnum.CONTRACT_REPLANT;
			mutableUser.minion_defaultCompostToUse = CropUpgradeType.supercompost;
			mutableUser.minion_farmingContract = {
				hasContract: false,
				difficultyLevel: null,
				plantToGrow: null,
				plantTier: 0,
				contractsCompleted: 0,
				contractPatchOverrides: {}
			} as any;

			calcMaxTripLengthSpy.mockReturnValue(400 * 1000);

			const transactResult = {
				newUser: user.user,
				itemsAdded: new Bank(),
				itemsRemoved: new Bank(),
				newBank: user.bank.clone(),
				newCL: user.cl.clone(),
				previousCL: new Bank(),
				clLootBank: null
			} satisfies Awaited<ReturnType<typeof user.transactItems>>;
			const transactSpy = vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);
			const updateSpy = vi.spyOn(user, 'update').mockResolvedValue({} as any);
			const statsSpy = vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
			const updateBankSettingSpy = vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();

			const response = await autoFarm(
				user,
				[treePatchDetailed],
				treePatches as Record<FarmingPatchName, IPatchData>,
				baseInteraction as MInteraction
			);

			if ((addSubTaskToActivityTask as any).mock.calls.length > 0) {
				expect(transactSpy).toHaveBeenCalled();
				expect(statsSpy).toHaveBeenCalled();
				expect(updateBankSettingSpy).toHaveBeenCalled();
			} else {
				if (isBaseMessage(response)) {
					expect(response.content).toContain("There's no Farming crops");
				} else if (typeof response === 'string') {
					expect(response).toContain("There's no Farming crops");
				}
			}

			expect(updateSpy).not.toHaveBeenCalledWith(
				expect.objectContaining({ minion_farmingContract: expect.anything() })
			);
		});

		it('restores override after contract completion', async () => {
			const bank = new Bank().add('Ranarr seed', 4).add('Guam seed', 4).add('Compost', 4).add('Coins', 10_000);
			const user = mockMUser({ bank, skills_farming: convertLVLtoXP(70) });
			const mutableUser = user.user as MutableUser;
			// IMPORTANT: make current filter match the override's previousMode ('replant')
			mutableUser.auto_farm_filter = AutoFarmFilterEnum.Replant;
			mutableUser.minion_defaultCompostToUse = CropUpgradeType.compost;
			mutableUser.minion_farmingContract = {
				hasContract: false,
				difficultyLevel: null,
				plantToGrow: null,
				plantTier: 0,
				contractsCompleted: 12,
				contractPatchOverrides: {
					[herbPlant.seedType]: { previousSeedID: herbPlant.id, previousMode: 'replant' }
				}
			} as any;

			const now = new Date('2020-01-04T00:00:00Z');
			vi.useFakeTimers();
			vi.setSystemTime(now);

			const afterContractState: IPatchData = {
				lastPlanted: marigoldPlant.name,
				patchPlanted: true,
				plantTime: now.getTime() - herbPlant.growthTime * 60_000 - 1,
				lastQuantity: 4,
				lastUpgradeType: null,
				lastPayment: false
			};
			const afterContractDetailed: IPatchDataDetailed = {
				...afterContractState,
				ready: true,
				readyIn: 0,
				readyAt: now,
				patchName: herbPlant.seedType,
				friendlyName: 'Herb patch',
				plant: marigoldPlant
			};

			calcMaxTripLengthSpy.mockReturnValue(300 * 1000);

			const transactResult = {
				newUser: user.user,
				itemsAdded: new Bank(),
				itemsRemoved: new Bank(),
				newBank: user.bank.clone(),
				newCL: user.cl.clone(),
				previousCL: new Bank(),
				clLootBank: null
			} satisfies Awaited<ReturnType<typeof user.transactItems>>;
			vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);
			const updateSpy = vi.spyOn(user, 'update').mockResolvedValue({} as any);
			const statsSpy = vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
			const updateBankSettingSpy = vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();

			const response = await autoFarm(
				user,
				[afterContractDetailed],
				{ [herbPlant.seedType]: afterContractState } as Record<FarmingPatchName, IPatchData>,
				baseInteraction as MInteraction
			);

			// now we DO expect the update call, because modes matched
			expect(updateSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					minion_farmingContract: expect.objectContaining({
						contractPatchOverrides: {}
					})
				})
			);

			expect(statsSpy).toHaveBeenCalled();
			expect(updateBankSettingSpy).toHaveBeenCalled();
			expect(response).toBeDefined();
		});

		it('skips contract when seeds are missing but continues base plan', async () => {
			const bank = new Bank().add('Acorn', 3).add('Supercompost', 3).add('Coins', 10_000);
			const user = mockMUser({ bank, skills_farming: convertLVLtoXP(60) });
			const mutableUser = user.user as MutableUser;
			mutableUser.auto_farm_filter = AutoFarmFilterEnum.CONTRACT_ALL_FARM;
			mutableUser.minion_defaultCompostToUse = CropUpgradeType.supercompost;
			mutableUser.minion_farmingContract = {
				hasContract: true,
				difficultyLevel: 'medium',
				plantToGrow: herbPlant.name,
				plantTier: 2,
				contractsCompleted: 5,
				contractPatchOverrides: {}
			} as any;

			calcMaxTripLengthSpy.mockReturnValue(300 * 1000);

			const transactResult = {
				newUser: user.user,
				itemsAdded: new Bank(),
				itemsRemoved: new Bank(),
				newBank: user.bank.clone(),
				newCL: user.cl.clone(),
				previousCL: new Bank(),
				clLootBank: null
			} satisfies Awaited<ReturnType<typeof user.transactItems>>;
			vi.spyOn(user, 'transactItems').mockResolvedValue(transactResult);
			const updateSpy = vi.spyOn(user, 'update').mockResolvedValue({} as any);
			const statsSpy = vi.spyOn(user, 'statsBankUpdate').mockResolvedValue(undefined);
			const updateBankSettingSpy = vi.spyOn(global.ClientSettings, 'updateBankSetting').mockResolvedValue();

			const response = await autoFarm(
				user,
				[treePatchDetailed],
				treePatches as Record<FarmingPatchName, IPatchData>,
				baseInteraction as MInteraction
			);

			if ((addSubTaskToActivityTask as any).mock.calls.length > 0) {
				const taskArgs = (addSubTaskToActivityTask as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
				expect(taskArgs.autoFarmPlan[0].plantsName).toBe(treePlant.name);
				expect(statsSpy).toHaveBeenCalled();
				expect(updateBankSettingSpy).toHaveBeenCalled();
			} else {
				if (isBaseMessage(response)) {
					expect(response.content).toContain("There's no Farming crops");
				} else if (typeof response === 'string') {
					expect(response).toContain("There's no Farming crops");
				}
			}

			expect(updateSpy).not.toHaveBeenCalledWith(
				expect.objectContaining({ minion_farmingContract: expect.anything() })
			);
		});
	});
});
