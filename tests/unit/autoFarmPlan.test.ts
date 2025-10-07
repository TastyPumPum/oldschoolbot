import { Time } from '@oldschoolgg/toolkit';
import { Bank, convertLVLtoXP } from 'oldschooljs';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockMUser } from './userutil.js';

const addSubTaskToActivityTaskMock = vi.fn();
const prepareFarmingStepMock = vi.fn();
const calcMaxTripLengthMock = vi.fn();
const allFarmMock = vi.fn(() => true);

const mockPlantFixtures = vi.hoisted(() => {
	const createMockPlant = (
		name: string,
		seedType: 'tree' | 'herb' | 'fruit_tree',
		level: number,
		input: Record<string, number>
	) => ({
		id: seedType.length,
		name,
		aliases: [name.toLowerCase()],
		seedType,
		level,
		plantXp: 0,
		checkXp: 0,
		harvestXp: 0,
		herbXp: undefined,
		herbLvl: undefined,
		inputItemsRecord: input,
		outputCrop: undefined,
		givesLogs: false,
		givesCrops: true,
		fixedOutput: true,
		fixedOutputAmount: 1,
		variableYield: false,
		numOfStages: 1,
		chanceOfDeath: 0,
		chance1: 0,
		chance99: 0,
		treeWoodcuttingLevel: undefined,
		needsChopForHarvest: false,
		petChance: 1,
		growthTime: 0,
		timePerPatchTravel: 10,
		timePerHarvest: 10,
		woodcuttingXp: undefined,
		canPayFarmer: false,
		canCompostPatch: true,
		canCompostandPay: false,
		protectionPayment: null
	});

	return [
		createMockPlant('Magic tree', 'tree', 75, { 'Magic seed': 1 }),
		createMockPlant('Snapdragon', 'herb', 62, { 'Snapdragon seed': 3 }),
		createMockPlant('Apple tree', 'fruit_tree', 55, { 'Apple tree seed': 1 })
	];
});

const mockedPlants: any[] = [];

vi.mock('../../src/lib/util/addSubTaskToActivityTask.js', () => ({
	default: addSubTaskToActivityTaskMock
}));

vi.mock('../../src/lib/minions/functions/farmingTripHelpers.js', () => ({
	prepareFarmingStep: prepareFarmingStepMock
}));

vi.mock('../../src/lib/util/calcMaxTripLength.js', () => ({
	calcMaxTripLength: calcMaxTripLengthMock
}));

vi.mock('../../src/lib/minions/functions/autoFarmFilters.js', () => ({
	allFarm: allFarmMock,
	replant: vi.fn(() => true)
}));

vi.mock('../../src/lib/skilling/skills/farming/index.js', () => ({
	plants: mockedPlants
}));

for (const fixture of mockPlantFixtures) {
	const { inputItemsRecord, ...plant } = fixture;
	mockedPlants.push({
		...plant,
		inputItems: new Bank(inputItemsRecord)
	});
}

const { autoFarm } = await import('../../src/lib/minions/functions/autoFarm.js');

describe('autoFarm multi patch planning', () => {
	const updateBankSettingMock = vi.fn();
	let originalClientSettings: any;

	beforeEach(() => {
		addSubTaskToActivityTaskMock.mockReset();
		prepareFarmingStepMock.mockReset();
		calcMaxTripLengthMock.mockReset();
		allFarmMock.mockClear();
		updateBankSettingMock.mockReset();

		const globalObj = globalThis as { ClientSettings?: any };
		if (typeof originalClientSettings === 'undefined') {
			originalClientSettings = globalObj.ClientSettings;
		}
		globalObj.ClientSettings = {
			...globalObj.ClientSettings,
			updateBankSetting: updateBankSettingMock
		};
	});

	afterAll(() => {
		const globalObj = globalThis as { ClientSettings?: any };
		if (typeof originalClientSettings === 'undefined') {
			Reflect.deleteProperty(globalObj, 'ClientSettings');
		} else {
			globalObj.ClientSettings = originalClientSettings;
		}
	});

	function buildDetailedPatch(patchName: 'tree' | 'herb' | 'fruit_tree', friendlyName: string, now: number) {
		return {
			ready: true,
			readyIn: null,
			readyAt: null,
			patchName,
			friendlyName,
			plant: null,
			lastPlanted: null,
			patchPlanted: false,
			plantTime: now,
			lastQuantity: 0,
			lastUpgradeType: null,
			lastPayment: false
		} as const;
	}

	function buildPatch(now: number) {
		return {
			lastPlanted: null,
			patchPlanted: false,
			plantTime: now,
			lastQuantity: 0,
			lastUpgradeType: null,
			lastPayment: false
		} as const;
	}

	it('plans multiple patch types when total duration fits within the max trip length', async () => {
		const user = mockMUser({
			bank: new Bank({ Coins: 5_000, 'Magic seed': 1, 'Snapdragon seed': 6, 'Apple tree seed': 2 }),
			GP: 10_000,
			skills_farming: convertLVLtoXP(99),
			skills_woodcutting: convertLVLtoXP(90),
			QP: 200
		});
		user.user.minion_defaultCompostToUse = 'ultracompost';
		Object.defineProperty(user, 'minionIsBusy', { get: () => false });
		user.statsBankUpdate = vi.fn().mockResolvedValue(undefined);
		user.transactItems = vi.fn().mockResolvedValue({ newUser: user.user });

		calcMaxTripLengthMock.mockReturnValue(Time.Minute * 30);

		const stepConfigs: Record<
			string,
			{
				quantity: number;
				duration: number;
				cost: Record<string, number>;
				upgradeType: string | null;
				didPay: boolean;
				info: string[];
				boosts: string[];
				treeChopFee: number;
			}
		> = {
			tree: {
				quantity: 1,
				duration: Time.Minute * 10,
				cost: { 'Magic seed': 1 },
				upgradeType: null,
				didPay: false,
				info: ['Bring an axe for the next harvest'],
				boosts: ['Tree patch boost'],
				treeChopFee: 2_000
			},
			herb: {
				quantity: 3,
				duration: Time.Minute * 5,
				cost: { 'Snapdragon seed': 3, Ultracompost: 3 },
				upgradeType: 'ultracompost',
				didPay: false,
				info: ['Remember to check the herb patches'],
				boosts: ['Herb patch boost'],
				treeChopFee: 0
			},
			fruit_tree: {
				quantity: 1,
				duration: Time.Minute * 15,
				cost: { 'Apple tree seed': 1, Coins: 200 },
				upgradeType: null,
				didPay: true,
				info: ['You paid the farmer to watch your tree'],
				boosts: ['Fruit tree patch boost'],
				treeChopFee: 0
			}
		};

		prepareFarmingStepMock.mockImplementation(({ plant }: { plant: { seedType: string } }) => {
			const config = stepConfigs[plant.seedType];
			if (!config) throw new Error(`Missing config for ${plant.seedType}`);
			return {
				success: true,
				data: {
					quantity: config.quantity,
					duration: config.duration,
					cost: new Bank(config.cost),
					didPay: config.didPay,
					upgradeType: config.upgradeType,
					infoStr: [...config.info],
					boostStr: [...config.boosts],
					treeChopFee: config.treeChopFee
				}
			};
		});

		const now = Date.now();
		const patchesDetailed = [
			buildDetailedPatch('tree', 'Tree patch', now),
			buildDetailedPatch('herb', 'Herb patch', now),
			buildDetailedPatch('fruit_tree', 'Fruit tree patch', now)
		];
		const patches = {
			tree: buildPatch(now),
			herb: buildPatch(now),
			fruit_tree: buildPatch(now)
		};

		const response = await autoFarm(user, patchesDetailed, patches as any, '123');
		expect(typeof response).toBe('string');
		const message = response as string;

		expect(message).toContain('Tree patch: 1x Magic tree');
		expect(message).toContain('Herb patch: 3x Snapdragon');
		expect(message).toContain('Fruit tree patch: 1x Apple tree');
		expect(message).toContain('Tree patch: Bring an axe for the next harvest');
		expect(message).toContain('Herb patch: Remember to check the herb patches');
		expect(message).toContain('Fruit tree patch: You paid the farmer to watch your tree');
		expect(message).toContain('**Boosts**: Tree patch boost, Herb patch boost, Fruit tree patch boost');
		expect(message).not.toContain('Some ready patches were skipped');

		expect(updateBankSettingMock).toHaveBeenCalledTimes(1);
		const costBank = updateBankSettingMock.mock.calls[0]?.[1] as Bank;
		expect(costBank.amount('Magic seed')).toBe(1);
		expect(costBank.amount('Snapdragon seed')).toBe(3);
		expect(costBank.amount('Ultracompost')).toBe(3);
		expect(costBank.amount('Apple tree seed')).toBe(1);
		expect(costBank.amount('Coins')).toBe(200);

		expect(user.statsBankUpdate).toHaveBeenCalledTimes(1);
		const statsCall = (user.statsBankUpdate as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(statsCall[0]).toBe('farming_plant_cost_bank');
		const statsBank = statsCall[1] as Bank;
		expect(statsBank.amount('Magic seed')).toBe(1);
		expect(statsBank.amount('Snapdragon seed')).toBe(3);
		expect(statsBank.amount('Ultracompost')).toBe(3);
		expect(statsBank.amount('Apple tree seed')).toBe(1);
		expect(statsBank.amount('Coins')).toBe(200);

		expect(user.transactItems).toHaveBeenCalledTimes(1);
		const transactArgs = (user.transactItems as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
		const removedBank = transactArgs.itemsToRemove as Bank;
		expect(removedBank.amount('Magic seed')).toBe(1);
		expect(removedBank.amount('Snapdragon seed')).toBe(3);
		expect(removedBank.amount('Ultracompost')).toBe(3);
		expect(removedBank.amount('Apple tree seed')).toBe(1);
		expect(removedBank.amount('Coins')).toBe(200);

		expect(addSubTaskToActivityTaskMock).toHaveBeenCalledTimes(1);
		const taskArgs = addSubTaskToActivityTaskMock.mock.calls[0]?.[0];
		expect(taskArgs.autoFarmCombined).toBe(true);
		expect(taskArgs.duration).toBe(Time.Minute * 30);
		expect(taskArgs.autoFarmPlan).toHaveLength(3);
		expect(taskArgs.autoFarmPlan.map((step: any) => step.patchType)).toEqual([
			patches.tree,
			patches.herb,
			patches.fruit_tree
		]);
	});

	it('skips ready patches that would exceed the trip length limit', async () => {
		const user = mockMUser({
			bank: new Bank({ Coins: 3_000, 'Magic seed': 1, 'Snapdragon seed': 3, 'Apple tree seed': 1 }),
			GP: 5_000,
			skills_farming: convertLVLtoXP(99),
			skills_woodcutting: convertLVLtoXP(90),
			QP: 200
		});
		Object.defineProperty(user, 'minionIsBusy', { get: () => false });
		user.statsBankUpdate = vi.fn().mockResolvedValue(undefined);
		user.transactItems = vi.fn().mockResolvedValue({ newUser: user.user });

		calcMaxTripLengthMock.mockReturnValue(Time.Minute * 10);

		const stepConfigs = new Map<
			string,
			{
				quantity: number;
				duration: number;
				cost: Record<string, number>;
				didPay: boolean;
				upgradeType: string | null;
				info: string[];
				boosts: string[];
				treeChopFee: number;
			}
		>([
			[
				'tree',
				{
					quantity: 1,
					duration: Time.Minute * 6,
					cost: { 'Magic seed': 1 },
					didPay: false,
					upgradeType: null,
					info: ['Tree patch ready'],
					boosts: ['Tree patch boost'],
					treeChopFee: 0
				}
			],
			[
				'herb',
				{
					quantity: 3,
					duration: Time.Minute * 5,
					cost: { 'Snapdragon seed': 3 },
					didPay: false,
					upgradeType: null,
					info: ['Herb patch ready'],
					boosts: ['Herb patch boost'],
					treeChopFee: 0
				}
			],
			[
				'fruit_tree',
				{
					quantity: 1,
					duration: Time.Minute * 4,
					cost: { 'Apple tree seed': 1 },
					didPay: false,
					upgradeType: null,
					info: ['Fruit tree patch ready'],
					boosts: ['Fruit tree patch boost'],
					treeChopFee: 0
				}
			]
		]);

		prepareFarmingStepMock.mockImplementation(({ plant }: { plant: { seedType: string } }) => {
			const config = stepConfigs.get(plant.seedType);
			if (!config) throw new Error(`Missing config for ${plant.seedType}`);
			return {
				success: true,
				data: {
					quantity: config.quantity,
					duration: config.duration,
					cost: new Bank(config.cost),
					didPay: config.didPay,
					upgradeType: config.upgradeType,
					infoStr: [...config.info],
					boostStr: [...config.boosts],
					treeChopFee: config.treeChopFee
				}
			};
		});

		const now = Date.now();
		const patchesDetailed = [
			buildDetailedPatch('tree', 'Tree patch', now),
			buildDetailedPatch('herb', 'Herb patch', now),
			buildDetailedPatch('fruit_tree', 'Fruit tree patch', now)
		];
		const patches = {
			tree: buildPatch(now),
			herb: buildPatch(now),
			fruit_tree: buildPatch(now)
		};

		const response = await autoFarm(user, patchesDetailed, patches as any, '321');
		expect(typeof response).toBe('string');
		const message = response as string;

		expect(prepareFarmingStepMock).toHaveBeenCalledTimes(3);
		expect(message).toContain('Tree patch: 1x Magic tree');
		expect(message).toContain('Fruit tree patch: 1x Apple tree');
		expect(message).not.toContain('Herb patch:');
		expect(message).toContain(
			'Some ready patches were skipped because the total trip length would exceed the maximum'
		);

		expect(addSubTaskToActivityTaskMock).toHaveBeenCalledTimes(1);
		const taskArgs = addSubTaskToActivityTaskMock.mock.calls[0]?.[0];
		expect(taskArgs.autoFarmPlan).toHaveLength(2);
		expect(taskArgs.autoFarmPlan.map((step: any) => step.plantsName)).toEqual(['Magic tree', 'Apple tree']);
		expect(taskArgs.duration).toBe(Time.Minute * 10);
	});
});
