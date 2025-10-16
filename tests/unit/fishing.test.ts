import { Bank } from 'oldschooljs';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Fishing } from '../../src/lib/skilling/skills/fishing/fishing.js';
import { calcFishingTripStart } from '../../src/lib/skilling/skills/fishing/fishingTripStart.js';
import { makeGearBank } from './utils.js';

describe('calcFishingTripStart', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('returns error when wanting to use flakes but none are present and allows retrying without flakes', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Sardine/Herring')!;

		const gearBank = makeGearBank({ bank: new Bank().add('Fishing bait', 5) });

		const res = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 2,
			wantsToUseFlakes: true,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof res).toBe('string');
		expect((res as string).toLowerCase()).toContain('spirit flake');

		vi.spyOn(Math, 'random').mockReturnValue(0);
		const ok = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 2,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof ok).toBe('object');
		const result = ok as Exclude<typeof ok, string>;
		expect(result.quantity).toBeGreaterThan(0);
	});

	test('returns helpful message when final quantity is 0', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Tuna/Swordfish')!;

		const gearBank = makeGearBank({
			bank: new Bank(),
			skillsAsLevels: { fishing: 1 }
		});

		const res = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 0,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof res).toBe('string');
		expect((res as string).toLowerCase()).toContain("can't fish any");
	});

	test('minnow scaling produces a valid quantity and duration', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Minnow')!;
		const gearBank = makeGearBank({ bank: new Bank().add('Sandworms', 50) });

		vi.spyOn(Math, 'random').mockReturnValue(0);

		const res = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: undefined,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof res).toBe('object');
		const out = res as Exclude<typeof res, string>;
		expect(Number.isFinite(out.duration)).toBeTruthy();
		expect(out.quantity).toBeGreaterThanOrEqual(1);
	});

	test('harpoon gear adds the appropriate boost message', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Shark')!;
		vi.spyOn(Math, 'random').mockReturnValue(0);

		const baseGearBank = makeGearBank();
		const base = calcFishingTripStart({
			gearBank: baseGearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 5,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof base).toBe('object');
		const baseResult = base as Exclude<typeof base, string>;
		expect(baseResult.boosts.some(b => b.includes('harpoon'))).toBeFalsy();

		const harpoonGearBank = makeGearBank();
		harpoonGearBank.gear.skilling.equip('Dragon harpoon');

		const withHarpoon = calcFishingTripStart({
			gearBank: harpoonGearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 5,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof withHarpoon).toBe('object');
		const harpoonResult = withHarpoon as Exclude<typeof withHarpoon, string>;
		expect(harpoonResult.boosts.some(b => b.includes('Dragon harpoon'))).toBeTruthy();
	});

	test('fish barrel in the bank applies the extended trip boost', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Lobster')!;
		vi.spyOn(Math, 'random').mockReturnValue(0);

		const noBarrel = calcFishingTripStart({
			gearBank: makeGearBank({ bank: new Bank() }),
			fish,
			maxTripLength: 1_000_000,
			quantityInput: undefined,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof noBarrel).toBe('object');
		const noBarrelResult = noBarrel as Exclude<typeof noBarrel, string>;
		expect(noBarrelResult.boosts.some(b => b.includes('Fish barrel'))).toBeFalsy();

		const withBarrel = calcFishingTripStart({
			gearBank: makeGearBank({ bank: new Bank().add('Fish barrel') }),
			fish,
			maxTripLength: 1_000_000,
			quantityInput: undefined,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof withBarrel).toBe('object');
		const withBarrelResult = withBarrel as Exclude<typeof withBarrel, string>;
		expect(withBarrelResult.boosts.some(b => b.includes('Fish barrel'))).toBeTruthy();
	});

	test('caps flakes to final quantity and records usage', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Sardine/Herring')!;
		vi.spyOn(Math, 'random').mockReturnValue(0);

		const gearBank = makeGearBank({ bank: new Bank().add('Fishing bait', 1).add('Spirit flakes', 5) });

		const res = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 5,
			wantsToUseFlakes: true,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof res).toBe('object');
		const out = res as Exclude<typeof res, string>;
		expect(out.quantity).toBeGreaterThanOrEqual(1);
		expect(out.flakesBeingUsed).toBeLessThanOrEqual(out.quantity);
		expect(out.isUsingSpiritFlakes).toBeTruthy();
		expect(out.spiritFlakePreference).toBe(true);
		expect(out.suppliesToRemove.amount('Spirit flakes')).toBe(out.flakesBeingUsed);
		expect(out.suppliesToRemove.amount('Fishing bait')).toBe(out.quantity);
	});

	test('powerfishing disables spirit flakes usage', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Trout/Salmon')!;
		vi.spyOn(Math, 'random').mockReturnValue(0);

		const gearBank = makeGearBank({ bank: new Bank().add('Feather', 25).add('Spirit flakes', 25) });

		const res = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 10,
			wantsToUseFlakes: true,
			powerfish: true,
			hasWildyEliteDiary: false
		});

		expect(typeof res).toBe('object');
		const out = res as Exclude<typeof res, string>;
		expect(out.isPowerfishing).toBeTruthy();
		expect(out.isUsingSpiritFlakes).toBeFalsy();
		expect(out.flakesBeingUsed).toBeUndefined();
		expect(out.spiritFlakePreference).toBe(true);
	});

	test('spirit flakes are consumed even when no bonus fish are granted', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Sardine/Herring')!;
		vi.spyOn(Math, 'random').mockReturnValue(0.99);

		const gearBank = makeGearBank({ bank: new Bank().add('Fishing bait', 10).add('Spirit flakes', 10) });

		const res = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 5,
			wantsToUseFlakes: true,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof res).toBe('object');
		const out = res as Exclude<typeof res, string>;
		expect(out.flakesBeingUsed).toBe(out.quantity);
		expect(out.suppliesToRemove.amount('Spirit flakes')).toBe(out.quantity);
	});

	test('limited trip length reduces catches without failing the request', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Tuna/Swordfish')!;
		vi.spyOn(Math, 'random').mockReturnValue(0);

		const gearBank = makeGearBank();

		const res = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000,
			quantityInput: 10,
			wantsToUseFlakes: false,
			powerfish: false,
			hasWildyEliteDiary: false
		});

		expect(typeof res).toBe('object');
		const out = res as Exclude<typeof res, string>;
		expect(out.quantity).toBeGreaterThanOrEqual(1);
		expect(out.quantity).toBeLessThan(10);
	});
});
