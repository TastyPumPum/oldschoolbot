import { describe, expect, test } from 'vitest';

import { hasActiveLuckyPennyEffect } from '../../src/lib/luckyPenny.js';

describe("Ghommal's lucky penny", () => {
	test.each([
		{ ownsPenny: true, consumedPenny: false, masterRewardsUnlocked: true, expected: true },
		{ ownsPenny: true, consumedPenny: false, masterRewardsUnlocked: false, expected: false },
		{ ownsPenny: false, consumedPenny: false, masterRewardsUnlocked: true, expected: false },
		{ ownsPenny: false, consumedPenny: true, masterRewardsUnlocked: true, expected: true },
		{ ownsPenny: false, consumedPenny: true, masterRewardsUnlocked: false, expected: false }
	])('is active=$expected when ownsPenny=$ownsPenny consumedPenny=$consumedPenny and master rewards unlocked=$masterRewardsUnlocked', ({
		ownsPenny,
		consumedPenny,
		masterRewardsUnlocked,
		expected
	}) => {
		const user = {
			bitfield: consumedPenny ? [59] : [],
			hasEquippedOrInBank: () => ownsPenny,
			hasCompletedCATier: () => masterRewardsUnlocked
		};

		expect(hasActiveLuckyPennyEffect(user as MUser)).toBe(expected);
	});
});
