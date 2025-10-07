import { Bank } from 'oldschooljs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BitField } from '../../src/lib/constants.js';
import type { FarmingActivityTaskOptions } from '../../src/lib/types/minions.js';

const mocks = vi.hoisted(() => {
	return {
		executeFarmingStepMock: vi.fn(),
		handleTripFinishMock: vi.fn(),
		makeAutoContractButtonMock: vi.fn(),
		canRunAutoContractMock: vi.fn()
	};
});

vi.mock('@/tasks/minions/farmingStep.js', () => ({
	__esModule: true,
	executeFarmingStep: mocks.executeFarmingStepMock
}));
vi.mock('@/lib/util/handleTripFinish.js', () => ({
	__esModule: true,
	handleTripFinish: mocks.handleTripFinishMock
}));
vi.mock('@/lib/util/interactions.js', () => ({
	__esModule: true,
	makeAutoContractButton: mocks.makeAutoContractButtonMock
}));
vi.mock('@/mahoji/lib/abstracted_commands/farmingContractCommand.js', () => ({
	__esModule: true,
	canRunAutoContract: mocks.canRunAutoContractMock
}));

const { handleCombinedAutoFarm } = await import('../../src/tasks/minions/combinedAutoFarmActivity.js');

describe('handleCombinedAutoFarm auto contract button behaviour', () => {
	let user: MUserStub;
	let taskData: FarmingActivityTaskOptions;

	beforeEach(() => {
		mocks.executeFarmingStepMock.mockReset();
		mocks.handleTripFinishMock.mockReset();
		mocks.makeAutoContractButtonMock.mockReset().mockReturnValue('AUTO_BUTTON');
		mocks.canRunAutoContractMock.mockReset();
		vi.stubGlobal('prisma', {
			farmedCrop: {
				create: vi.fn().mockResolvedValue({ id: 123 })
			}
		});
		vi.stubGlobal('ClientSettings', {
			updateBankSetting: vi.fn().mockResolvedValue(undefined)
		});

		mocks.executeFarmingStepMock.mockResolvedValue({
			message: 'finished step',
			loot: new Bank().add('Seed pack', 1),
			summary: {
				duration: 60_000,
				xp: {
					planting: 0,
					harvest: 0,
					checkHealth: 0,
					rake: 0,
					bonus: 0,
					totalFarming: 0,
					woodcutting: 0,
					herblore: 0
				},
				xpMessages: {},
				contractCompleted: true
			}
		});

		user = {
			id: '1',
			bitfield: [] as number[],
			minionName: 'AutoFarmer',
			hasEquippedOrInBank: vi.fn().mockReturnValue(false),
			skillsAsLevels: {
				farming: 99,
				woodcutting: 99,
				herblore: 99
			},
			addXP: vi.fn().mockResolvedValue(''),
			transactItems: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
			statsBankUpdate: vi.fn().mockResolvedValue(undefined),
			farmingContract: vi.fn().mockReturnValue({ contract: null }),
			toString() {
				return 'AutoFarmer';
			}
		} as MUserStub;

		taskData = {
			type: 'Farming',
			plantsName: 'Test herb',
			patchType: {} as any,
			userID: '1',
			channelID: '123',
			quantity: 1,
			upgradeType: null,
			payment: false,
			treeChopFeePaid: 0,
			treeChopFeePlanned: 0,
			planting: true,
			duration: 60_000,
			currentDate: Date.now(),
			finishDate: Date.now() + 60_000,
			autoFarmed: true,
			autoFarmPlan: [
				{
					plantsName: 'Test herb',
					quantity: 1,
					upgradeType: null,
					payment: false,
					treeChopFeePaid: 0,
					treeChopFeePlanned: 0,
					patchType: {} as any,
					planting: true,
					currentDate: Date.now(),
					duration: 60_000
				}
			]
		} as FarmingActivityTaskOptions;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('relies on handleTripFinish when auto contract is available', async () => {
		mocks.canRunAutoContractMock.mockResolvedValue(true);

		await handleCombinedAutoFarm({ user: user as any, taskData });

		expect(mocks.executeFarmingStepMock).toHaveBeenCalledTimes(1);
		expect(mocks.handleTripFinishMock).toHaveBeenCalledTimes(1);
		const extraComponents = mocks.handleTripFinishMock.mock.calls[0]?.[7];
		expect(extraComponents).toBeUndefined();
		expect(mocks.makeAutoContractButtonMock).not.toHaveBeenCalled();
	});

	it('adds auto contract button when contract completed but auto contract unavailable', async () => {
		mocks.canRunAutoContractMock.mockResolvedValue(false);

		await handleCombinedAutoFarm({ user: user as any, taskData });

		const extraComponents = mocks.handleTripFinishMock.mock.calls[0]?.[7];
		expect(extraComponents).toEqual(['AUTO_BUTTON']);
		expect(mocks.makeAutoContractButtonMock).toHaveBeenCalledTimes(1);
	});

	it('respects the disable auto contract button bitfield', async () => {
		mocks.canRunAutoContractMock.mockResolvedValue(false);
		user.bitfield = [BitField.DisableAutoFarmContractButton];

		await handleCombinedAutoFarm({ user: user as any, taskData });

		const extraComponents = mocks.handleTripFinishMock.mock.calls[0]?.[7];
		expect(extraComponents).toBeUndefined();
		expect(mocks.makeAutoContractButtonMock).not.toHaveBeenCalled();
	});
});

type MUserStub = {
	id: string;
	bitfield: number[];
	minionName: string;
	hasEquippedOrInBank: ReturnType<typeof vi.fn>;
	skillsAsLevels: {
		farming: number;
		woodcutting: number;
		herblore: number;
	};
	addXP: ReturnType<typeof vi.fn>;
	transactItems: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	statsBankUpdate: ReturnType<typeof vi.fn>;
	farmingContract: ReturnType<typeof vi.fn>;
	toString(): string;
};
