import { describe, expect, test } from 'vitest';

import {
	applyApprovalDecay,
	cofferReductionPerDay,
	type KingdomInputs,
	simulateEV
} from '@/simulation/misc/ManagingMiscellania.js';

function createInputs(overrides: Partial<KingdomInputs> = {}): KingdomInputs {
	return {
		days: 7,
		workers: 10,
		category: 'herbs',
		startingApproval: 127,
		royalTrouble: false,
		constantApproval: false,
		startingCoffer: 50_000,
		...overrides
	};
}

describe('Managing Miscellania EV simulator', () => {
	test('baseline herbs scenario matches wiki reference', () => {
		const result = simulateEV(createInputs());

		expect(result.resourcePoints).toBe(366);
		expect(result.cofferSpent).toBe(26_109);
		expect(result.endingApproval).toBe(104);

		const herbs = result.byCategory[0]?.evBank ?? {};
		expect(herbs['Grimy tarromin']).toBeCloseTo(4.1304347, 6);
		expect(herbs['Grimy avantoe']).toBeCloseTo(2.4782608, 6);
		expect(herbs['Grimy ranarr weed']).toBeCloseTo(1.2391304, 6);
		expect(Object.keys(herbs)).toHaveLength(9);
	});

	test('low approval drastically reduces output', () => {
		const result = simulateEV(createInputs({ startingApproval: 40, startingCoffer: 20_000 }));

		expect(result.resourcePoints).toBe(37);
		expect(result.endingApproval).toBe(32);
		const herbs = result.byCategory[0]?.evBank ?? {};
		expect(herbs['Grimy ranarr weed']).toBeCloseTo(0.0652173, 6);
	});

	test('zero coffer yields zero resource points and loot', () => {
		const result = simulateEV(createInputs({ startingCoffer: 0 }));

		expect(result.resourcePoints).toBe(0);
		expect(result.cofferSpent).toBe(0);
		expect(result.byCategory[0]?.evBank ?? {}).toEqual({});
	});

	test('royal trouble improves resource points', () => {
		const withoutRoyalTrouble = simulateEV(createInputs());
		const withRoyalTrouble = simulateEV(createInputs({ royalTrouble: true }));

		expect(withRoyalTrouble.resourcePoints).toBeGreaterThan(withoutRoyalTrouble.resourcePoints);
	});

	test('days input is clamped to 30', () => {
		const thirtyDays = simulateEV(createInputs({ days: 30 }));
		const fortyFiveDays = simulateEV(createInputs({ days: 45 }));

		expect(fortyFiveDays.resourcePoints).toBe(thirtyDays.resourcePoints);
	});

	test('capped binomial drops respect their limits', () => {
		const low = simulateEV(
			createInputs({
				category: 'farm_seeds',
				royalTrouble: true,
				startingCoffer: 75_000
			})
		);
		const high = simulateEV({
			days: 30,
			workers: 15,
			category: 'farm_seeds',
			startingApproval: 127,
			royalTrouble: true,
			constantApproval: false,
			startingCoffer: 75_000
		});

		const lowRanarr = low.byCategory[0]?.evBank['Ranarr seed'] ?? 0;
		const highRanarr = high.byCategory[0]?.evBank['Ranarr seed'] ?? 0;
		expect(highRanarr).toBeGreaterThan(lowRanarr);
		expect(highRanarr).toBeLessThanOrEqual(2);
	});

	test('approval decay handles edge cases correctly', () => {
		expect(applyApprovalDecay(33, 1, false, false)).toBe(32);
		expect(applyApprovalDecay(33, 1, true, false)).toBe(32);
		expect(applyApprovalDecay(33, 1, false, true)).toBe(33);
		expect(applyApprovalDecay(32, 5, false, false)).toBe(32);
	});

	test('coffer reduction follows expected limits', () => {
		expect(cofferReductionPerDay(1000, false)).toBe(105);
		expect(cofferReductionPerDay(1000, true)).toBe(105);
		expect(cofferReductionPerDay(1_000_000, false)).toBe(50_000);
		expect(cofferReductionPerDay(1_000_000, true)).toBe(75_000);
	});

	test('resource points remain within hard cap', () => {
		const result = simulateEV({
			days: 30,
			workers: 15,
			category: 'herbs',
			startingApproval: 127,
			royalTrouble: true,
			constantApproval: true,
			startingCoffer: 1_000_000_000
		});

		expect(result.resourcePoints).toBeLessThanOrEqual(262_143);
		expect(result.resourcePoints).toBe(34_290);
	});
});
