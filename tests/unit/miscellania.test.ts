import { describe, expect, test } from 'vitest';

import {
	advanceMiscellaniaState,
	calculateMiscellaniaCost,
	calculateMiscellaniaDays,
	calculateMiscellaniaTripSeconds,
	daysElapsedSince,
	simulateDetailedMiscellania,
	validateAreas
} from '../../src/lib/miscellania/calc.js';

describe('miscellania simplified mechanics', () => {
	test('first trip defaults to 1 day', () => {
		expect(calculateMiscellaniaDays(null, 1_000_000)).toEqual(1);
	});

	test('days elapsed is clamped to 100', () => {
		const now = 1_000_000_000;
		const state = {
			lastClaimedAt: now - 130 * 24 * 60 * 60 * 1000,
			lastUpdatedAt: now - 130 * 24 * 60 * 60 * 1000,
			lastTopupAt: now - 130 * 24 * 60 * 60 * 1000,
			primaryArea: 'maple',
			secondaryArea: 'herbs',
			royalTrouble: true,
			coffer: 7_500_000,
			cofferAtLastClaim: 7_500_000,
			favour: 100,
			resourcePoints: 0
		} as const;
		expect(calculateMiscellaniaDays(state, now)).toEqual(100);
	});

	test('trip seconds and cost scale by days', () => {
		expect(calculateMiscellaniaTripSeconds(3)).toEqual(45);
		expect(calculateMiscellaniaCost(3)).toEqual(225_000);
	});

	test('cost and duration are clamped between 1 and 100 days', () => {
		expect(calculateMiscellaniaTripSeconds(0)).toEqual(15);
		expect(calculateMiscellaniaCost(0)).toEqual(75_000);
		expect(calculateMiscellaniaTripSeconds(150)).toEqual(1500);
		expect(calculateMiscellaniaCost(150)).toEqual(7_500_000);
	});

	test('daysElapsedSince floors partial days', () => {
		const now = 10_000_000;
		const twentyThreeHours = 23 * 60 * 60 * 1000;
		expect(daysElapsedSince(now - twentyThreeHours, now)).toEqual(0);
	});

	test('primary and secondary areas must differ', () => {
		expect(validateAreas('maple', 'maple')).toContain('must be different');
		expect(validateAreas('maple', 'herbs')).toBeNull();
	});

	test('prevents conflicting fishing and hardwood pairings', () => {
		expect(validateAreas('fishing_raw', 'fishing_cooked')).toContain('either Fishing (Raw) or Fishing (Cooked)');
		expect(validateAreas('mahogany', 'hardwood_both')).toContain('one hardwood mode');
	});

	test('days is at least 1 even if last claimed in the future', () => {
		const now = 500_000_000;
		const state = {
			lastClaimedAt: now + 2 * 24 * 60 * 60 * 1000,
			lastUpdatedAt: now + 2 * 24 * 60 * 60 * 1000,
			lastTopupAt: now + 2 * 24 * 60 * 60 * 1000,
			primaryArea: 'maple',
			secondaryArea: 'herbs',
			royalTrouble: true,
			coffer: 7_500_000,
			cofferAtLastClaim: 7_500_000,
			favour: 100,
			resourcePoints: 0
		} as const;
		expect(calculateMiscellaniaDays(state, now)).toEqual(1);
	});

	test('detailed sim matches expected 1-day non-RT values', () => {
		const result = simulateDetailedMiscellania({
			days: 1,
			royalTrouble: false,
			startingCoffer: 750_000,
			startingFavour: 100,
			constantFavour: false
		});
		expect(result.endingCoffer).toEqual(700_000);
		expect(result.gpSpent).toEqual(50_000);
		expect(result.resourcePoints).toEqual(600);
		expect(result.endingFavour).toEqual(96);
	});

	test('detailed sim matches expected 1-day RT values', () => {
		const result = simulateDetailedMiscellania({
			days: 1,
			royalTrouble: true,
			startingCoffer: 7_500_000,
			startingFavour: 100,
			constantFavour: false
		});
		expect(result.endingCoffer).toEqual(7_425_000);
		expect(result.gpSpent).toEqual(75_000);
		expect(result.resourcePoints).toEqual(900);
		expect(result.endingFavour).toEqual(97);
	});

	test('detailed sim constant favour keeps favour unchanged', () => {
		const result = simulateDetailedMiscellania({
			days: 10,
			royalTrouble: true,
			startingCoffer: 7_500_000,
			startingFavour: 88,
			constantFavour: true
		});
		expect(result.endingFavour).toEqual(88);
	});

	test('advance is capped to 100 days of progression since last claim', () => {
		const now = 1_000_000_000;
		const state = {
			lastClaimedAt: now - 300 * 24 * 60 * 60 * 1000,
			lastUpdatedAt: now - 300 * 24 * 60 * 60 * 1000,
			lastTopupAt: now - 300 * 24 * 60 * 60 * 1000,
			primaryArea: 'maple',
			secondaryArea: 'herbs',
			royalTrouble: true,
			coffer: 7_500_000,
			cofferAtLastClaim: 7_500_000,
			favour: 100,
			resourcePoints: 0
		} as const;
		const advanced = advanceMiscellaniaState(state, now);
		const expected = simulateDetailedMiscellania({
			days: 100,
			royalTrouble: true,
			startingCoffer: 7_500_000,
			startingFavour: 100,
			constantFavour: false
		});
		expect(advanced.coffer).toEqual(expected.endingCoffer);
		expect(advanced.resourcePoints).toEqual(expected.resourcePoints);
		expect(advanced.favour).toEqual(expected.endingFavour);

		const advancedAgain = advanceMiscellaniaState(advanced, now + 20 * 24 * 60 * 60 * 1000);
		expect(advancedAgain.coffer).toEqual(advanced.coffer);
		expect(advancedAgain.resourcePoints).toEqual(advanced.resourcePoints);
		expect(advancedAgain.favour).toEqual(advanced.favour);
	});
});
