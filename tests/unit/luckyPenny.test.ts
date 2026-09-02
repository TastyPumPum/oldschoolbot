import { describe, expect, test } from 'vitest';

import { hasActiveLuckyPennyEffect } from '../../src/lib/degradeableItems.js';

describe("Ghommal's lucky penny", () => {
	test.each([
		{ ownsPenny: true, masterRewardsUnlocked: true, expected: true },
		{ ownsPenny: true, masterRewardsUnlocked: false, expected: false },
		{ ownsPenny: false, masterRewardsUnlocked: true, expected: false }
	])('is active=$expected when ownsPenny=$ownsPenny and master rewards unlocked=$masterRewardsUnlocked', ({
		ownsPenny,
		masterRewardsUnlocked,
		expected
	}) => {
		const user = {
			hasEquippedOrInBank: () => ownsPenny,
			hasCompletedCATier: () => masterRewardsUnlocked
		};

		expect(hasActiveLuckyPennyEffect(user as MUser)).toBe(expected);
	});
});
