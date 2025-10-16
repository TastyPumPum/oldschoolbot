import { Bank, itemID } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import { calcFishingTripStart } from '../../src/lib/skilling/skills/fishing/fishingTripStart.js';
import { makeGearBank } from './utils.js';

const basicSpot = {
	name: 'Shrimps/Anchovies',
	subfishes: [
		{
			id: itemID('Raw shrimps'),
			level: 1,
			xp: 10,
			intercept: 1,
			slope: 0
		}
	],
	lostTicks: 0,
	bankingTime: 0,
	ticksPerRoll: 3
} as any;

describe('calcFishingTripStart', () => {
	test('returns error when wanting to use flakes but none are present', () => {
		const gearBank = makeGearBank({ bank: new Bank().add('Fishing bait', 5) });

		const res = calcFishingTripStart({
			gearBank,
			fish: basicSpot,
			maxTripLength: 1000000,
			quantityInput: 10,
			wantsToUseFlakes: true,
			powerfishing: false
		});

		expect(typeof res).toBe('string');
	});

	test('powerfishing disables spirit flakes usage', () => {
		const gearBank = makeGearBank({ bank: new Bank().add('Spirit flakes', 100) });
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1);

		const res = calcFishingTripStart({
			gearBank,
			fish: basicSpot,
			maxTripLength: 1000000,
			quantityInput: 50,
			wantsToUseFlakes: true,
			powerfishing: true
		});

		randomSpy.mockRestore();

		expect(typeof res).toBe('object');
		const out = res as any;
		expect(out.powerfishing).toBe(true);
		expect(out.spiritFlakes).toBe(false);
	});

	test('returns catches and loot arrays for valid trip', () => {
		const gearBank = makeGearBank({ bank: new Bank().add('Fishing bait', 500) });
		const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01);

		const res = calcFishingTripStart({
			gearBank,
			fish: basicSpot,
			maxTripLength: 10_000,
			quantityInput: 20,
			wantsToUseFlakes: false,
			powerfishing: false
		});

		randomSpy.mockRestore();

		expect(typeof res).toBe('object');
		const out = res as any;
		expect(out.catches.length).toBe(1);
		expect(out.loot.length).toBe(1);
		expect(out.quantity).toBeGreaterThan(0);
	});
});
