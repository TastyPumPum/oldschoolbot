import { MathRNG } from 'node-rng';
import { describe, expect, test } from 'vitest';

import {
	MAX_CRASH_MULTIPLIER,
	MIN_CRASH_MULTIPLIER,
	parseCrashAutoMultiplier,
	rollCrashPoint
} from '../../src/lib/util/crashGame.js';

describe('crashGame', () => {
	test('parseCrashAutoMultiplier supports plain and x suffix values', () => {
		expect(parseCrashAutoMultiplier('2')).toBe(200);
		expect(parseCrashAutoMultiplier('2x')).toBe(200);
		expect(parseCrashAutoMultiplier('2.25x')).toBe(225);
		expect(parseCrashAutoMultiplier('1.019')).toBe(101);
	});

	test('parseCrashAutoMultiplier rejects invalid inputs', () => {
		expect(parseCrashAutoMultiplier('')).toBeNull();
		expect(parseCrashAutoMultiplier('abc')).toBeNull();
		expect(parseCrashAutoMultiplier('-2')).toBeNull();
	});

	test('rollCrashPoint always returns in configured bounds', () => {
		for (let i = 0; i < 10_000; i++) {
			const rolled = rollCrashPoint(MathRNG, 'med');
			expect(rolled).toBeGreaterThanOrEqual(100);
			expect(rolled).toBeGreaterThanOrEqual(MIN_CRASH_MULTIPLIER - 1);
			expect(rolled).toBeLessThanOrEqual(MAX_CRASH_MULTIPLIER);
		}
	});
});
