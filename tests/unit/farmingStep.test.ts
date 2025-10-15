import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

function mockVirtualModule(path: string, factory: () => unknown) {
	(
		vi.mock as unknown as (
			modulePath: string,
			moduleFactory: () => unknown,
			options?: { virtual?: boolean }
		) => unknown
	)(path, factory, { virtual: true });
}

mockVirtualModule('@oldschoolgg/rng', () => ({
	randInt: () => 1,
	roll: () => false
}));

mockVirtualModule('@/lib/canvas/chatHeadImage.js', () => ({
	default: vi.fn()
}));

import type { MUser } from '../../src/lib/MUser.js';
import type { IPatchData } from '../../src/lib/skilling/skills/farming/utils/types.js';
import type { FarmingActivityTaskOptions } from '../../src/lib/types/minions.js';
import { executeFarmingStep } from '../../src/tasks/minions/farmingStep.js';

interface FakeUser {
	id: string;
	minionName: string;
	badgedUsername: string;
	mention: string;
	skillsAsLevels: {
		farming: number;
		woodcutting: number;
		herblore: number;
	};
	bitfield: number[];
	user: { GP: bigint };
	hasEquippedOrInBank: () => boolean;
	addXP: ReturnType<typeof vi.fn>;
	incrementKC: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
	farmingContract: () => {
		contract: {
			hasContract: boolean;
			difficultyLevel: null;
			plantToGrow: null;
			plantTier: number;
			contractsCompleted: number;
		};
	};
	transactItems: ReturnType<typeof vi.fn>;
	statsBankUpdate: ReturnType<typeof vi.fn>;
	addItemsToCollectionLog: ReturnType<typeof vi.fn>;
	addItemsToBank: ReturnType<typeof vi.fn>;
	removeItemsFromBank: ReturnType<typeof vi.fn>;
	toString: () => string;
}

const basePatch: IPatchData = {
	lastPlanted: 'Marigold',
	patchPlanted: true,
	plantTime: Date.now(),
	lastQuantity: 0,
	lastUpgradeType: null,
	lastPayment: false
};

const baseTaskData: FarmingActivityTaskOptions = {
	type: 'Farming',
	userID: '123',
	duration: 1,
	id: 1,
	finishDate: Date.now(),
	channelID: 'testing-channel',
	plantsName: 'Marigold',
	quantity: 2,
	upgradeType: null,
	payment: false,
	treeChopFeePaid: 0,
	treeChopFeePlanned: 0,
	patchType: basePatch,
	planting: false,
	currentDate: Date.now(),
	autoFarmed: false
};

type MockClientSettings = Record<string, unknown> & {
	updateBankSetting: ReturnType<typeof vi.fn>;
};
type MockPrisma = Record<string, unknown> & {
	farmedCrop: {
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
	};
};
type MockGlobalClient = Record<string, unknown> & {
	emit: ReturnType<typeof vi.fn>;
	users: {
		fetch: ReturnType<typeof vi.fn>;
		cache: Map<unknown, unknown>;
	};
};

const globals = globalThis as typeof globalThis & {
	ClientSettings?: MockClientSettings | undefined;
	prisma?: MockPrisma | undefined;
	globalClient?: MockGlobalClient | undefined;
};

const originalClientSettings = globals.ClientSettings;
const originalPrisma = globals.prisma;
const originalGlobalClient = globals.globalClient;

beforeEach(() => {
	globals.ClientSettings = {
		...(originalClientSettings ?? {}),
		updateBankSetting: vi.fn().mockResolvedValue(undefined)
	} as any;
	globals.prisma = {
		...(originalPrisma ?? {}),
		farmedCrop: {
			create: vi.fn().mockResolvedValue({ id: 1 }),
			update: vi.fn().mockResolvedValue(undefined)
		}
	} as any;
	globals.globalClient = {
		...(originalGlobalClient ?? {}),
		emit: vi.fn(),
		users: {
			fetch: vi.fn(),
			cache: new Map()
		}
	} as any;
});

afterEach(() => {
	globals.ClientSettings = originalClientSettings;
	globals.prisma = originalPrisma;
	globals.globalClient = originalGlobalClient;
});

function createUser(): FakeUser {
	const user: FakeUser = {
		id: '123',
		minionName: 'Sassy Minion',
		badgedUsername: 'Tester',
		mention: '<@123>',
		skillsAsLevels: {
			farming: 80,
			woodcutting: 1,
			herblore: 1
		},
		bitfield: [],
		user: { GP: BigInt(0) },
		hasEquippedOrInBank: () => false,
		addXP: vi.fn().mockResolvedValue('You received some XP.'),
		incrementKC: vi.fn().mockResolvedValue(undefined),
		update: vi.fn().mockResolvedValue(undefined),
		farmingContract: () => ({
			contract: {
				hasContract: false,
				difficultyLevel: null,
				plantToGrow: null,
				plantTier: 0,
				contractsCompleted: 0
			}
		}),
		transactItems: vi.fn().mockResolvedValue(undefined),
		statsBankUpdate: vi.fn().mockResolvedValue(undefined),
		addItemsToCollectionLog: vi.fn().mockResolvedValue(undefined),
		addItemsToBank: vi.fn().mockResolvedValue(undefined),
		removeItemsFromBank: vi.fn().mockResolvedValue(undefined),
		toString: () => '<@123>'
	};
	return user;
}

describe('executeFarmingStep messaging', () => {
	test('harvest-only messages begin with user and minion', async () => {
		const user = createUser();
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1);
		try {
			const result = await executeFarmingStep({
				user: user as unknown as MUser,
				channelID: 'testing-channel',
				data: { ...baseTaskData, patchType: { ...basePatch } }
			});

			expect(result?.message.startsWith(`${user}, ${user.minionName}`)).toBe(true);
		} finally {
			randomSpy.mockRestore();
		}
	});

	test('planting and harvesting messages begin with user and minion', async () => {
		const user = createUser();
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1);

		try {
			const result = await executeFarmingStep({
				user: user as unknown as MUser,
				channelID: 'testing-channel',
				data: {
					...baseTaskData,
					patchType: { ...basePatch },
					planting: true
				}
			});

			expect(result?.message.startsWith(`${user}, ${user.minionName}`)).toBe(true);
		} finally {
			randomSpy.mockRestore();
		}
	});
});
