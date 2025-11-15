import { type RNGProvider, SeedableRNG } from '@oldschoolgg/rng';
import { Time } from '@oldschoolgg/toolkit';
import { Bank, toKMB } from 'oldschooljs';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Fishing } from '../../src/lib/skilling/skills/fishing/fishing.js';
import { calcFishingTripStart } from '../../src/lib/skilling/skills/fishing/fishingTripStart.js';
import { makeGearBank } from './utils.js';

interface SimpleRNG {
	roll(max: number): boolean;
	randInt(min: number, max: number): number;
	randFloat(min: number, max: number): number;
	rand(): number;
	shuffle<T>(array: T[]): T[];
	pick<T>(array: T[]): T;
	percentChance(percent: number): boolean;
}

function createDeterministicRNG(seed = 1): SimpleRNG {
	let state = seed % 2147483647;
	if (state <= 0) state += 2147483646;

	const next = () => {
		state = (state * 16807) % 2147483647;
		return state / 2147483647;
	};

	return {
		roll(max: number) {
			return Math.floor(next() * max) === 0;
		},
		randInt(min: number, max: number) {
			return Math.floor(next() * (max - min + 1)) + min;
		},
		randFloat(min: number, max: number) {
			return next() * (max - min) + min;
		},
		rand() {
			return next();
		},
		shuffle<T>(array: T[]) {
			const result = [...array];
			for (let i = result.length - 1; i > 0; i--) {
				const j = Math.floor(next() * (i + 1));
				[result[i], result[j]] = [result[j], result[i]];
			}
			return result;
		},
		pick<T>(array: T[]) {
			return array[Math.floor(next() * array.length)];
		},
		percentChance(percent: number) {
			return next() < percent / 100;
		}
	};
}

class SequenceRNG implements RNGProvider {
	private readonly fallback = new SeedableRNG(1);
	private randQueue: number[];

	constructor(randQueue: number[]) {
		this.randQueue = [...randQueue];
	}

	private nextRand() {
		if (this.randQueue.length > 0) {
			return this.randQueue.shift()!;
		}
		return this.fallback.rand();
	}

	rand(): number {
		return this.nextRand();
	}

	randFloat(min: number, max: number): number {
		return min + (max - min) * this.nextRand();
	}

	randInt(min: number, max: number): number {
		return Math.floor(this.nextRand() * (max - min + 1)) + min;
	}

	roll(max: number): boolean {
		return this.randInt(1, max) === 1;
	}

	shuffle<T>(array: T[]): T[] {
		return this.fallback.shuffle(array);
	}

	pick<T>(array: T[]): T {
		return this.fallback.pick(array);
	}

	percentChance(percent: number): boolean {
		return this.nextRand() < percent / 100;
	}
}

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

	test('barbarian fishing respects agility/strength thresholds', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Barbarian fishing')!;
		const rngPattern = [0.25, 0.05, 0.05, 0.4];
		const rngQueue = Array.from({ length: 2500 }, () => rngPattern).flat();

		const lowLevels = makeGearBank({
			bank: new Bank().add('Feather', 500),
			skillsAsLevels: { fishing: 80, agility: 29, strength: 29, cooking: 80 }
		});
		const salmonLevels = makeGearBank({
			bank: new Bank().add('Feather', 500),
			skillsAsLevels: { fishing: 80, agility: 30, strength: 30, cooking: 80 }
		});
		const sturgeonLevels = makeGearBank({
			bank: new Bank().add('Feather', 500),
			skillsAsLevels: { fishing: 80, agility: 45, strength: 45, cooking: 80 }
		});

		const low = calcFishingTripStart({
			gearBank: lowLevels,
			fish,
			maxTripLength: 60 * 60 * 1000,
			quantityInput: 200,
			wantsToUseFlakes: false,
			powerfish: true,
			hasWildyEliteDiary: false,
			rng: new SequenceRNG(rngQueue)
		});
		expect(typeof low).toBe('object');
		if (typeof low === 'string') {
			throw new Error('Expected trip data for low levels');
		}
		expect(low.catches[1]).toBe(0);
		expect(low.catches[2]).toBe(0);

		const salmon = calcFishingTripStart({
			gearBank: salmonLevels,
			fish,
			maxTripLength: 60 * 60 * 1000,
			quantityInput: 200,
			wantsToUseFlakes: false,
			powerfish: true,
			hasWildyEliteDiary: false,
			rng: new SequenceRNG(rngQueue)
		});
		expect(typeof salmon).toBe('object');
		if (typeof salmon === 'string') {
			throw new Error('Expected trip data for salmon levels');
		}
		expect(salmon.catches[1]).toBeGreaterThan(0);
		expect(salmon.catches[2]).toBe(0);

		const sturgeon = calcFishingTripStart({
			gearBank: sturgeonLevels,
			fish,
			maxTripLength: 60 * 60 * 1000,
			quantityInput: 200,
			wantsToUseFlakes: false,
			powerfish: true,
			hasWildyEliteDiary: false,
			rng: new SequenceRNG(rngQueue)
		});
		expect(typeof sturgeon).toBe('object');
		if (typeof sturgeon === 'string') {
			throw new Error('Expected trip data for sturgeon levels');
		}
		expect(sturgeon.catches[1]).toBeGreaterThan(0);
		expect(sturgeon.catches[2]).toBeGreaterThan(0);
	});

	test('barbarian cut-eat powerfishing sustains bait and awards expected XP', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Barbarian fishing')!;
		const rng = createDeterministicRNG(321);

		const gearBank = makeGearBank({
			bank: new Bank().add('Feather', 1),
			skillsAsLevels: { fishing: 99, cooking: 99 }
		});

		const res = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 60 * 60 * 1000,
			quantityInput: undefined,
			wantsToUseFlakes: false,
			powerfish: true,
			hasWildyEliteDiary: false,
			rng
		});

		expect(typeof res).toBe('object');
		const start = res as Exclude<typeof res, string>;
		expect(start.quantity).toBeGreaterThan(1);
		expect(start.suppliesToRemove.amount('Feather')).toBeLessThanOrEqual(1);

		const result = Fishing.util.calcFishingTripResult({
			fish,
			duration: start.duration,
			catches: start.catches,
			loot: start.loot,
			gearBank,
			rng: createDeterministicRNG(321),
			usedBarbarianCutEat: start.usedBarbarianCutEat,
			isPowerfishing: start.isPowerfishing
		});

		const fishingXP = result.updateBank.xpBank.amount('fishing');
		const cookingXP = result.updateBank.xpBank.amount('cooking');
		const agilityXP = result.updateBank.xpBank.amount('agility');
		const strengthXP = result.updateBank.xpBank.amount('strength');

		expect(Number.isInteger(cookingXP)).toBe(true);
		expect(cookingXP).toBeGreaterThan(0);

		const perHour = (xp: number) => Math.floor((xp * Time.Hour) / start.duration);

		expect(result.xpPerHour).toBe(toKMB(perHour(fishingXP)));
		expect(result.bonusXpPerHour.agility).toBe(toKMB(perHour(agilityXP)));
		expect(result.bonusXpPerHour.strength).toBe(toKMB(perHour(strengthXP)));
		expect(result.bonusXpPerHour.cooking).toBe(toKMB(perHour(cookingXP)));
	});

	test('spirit flakes are consumed even when no bonus fish are granted', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Sardine/Herring')!;
		let idx = 0;
		const rolls = [0, 0.99, 0.99];
		vi.spyOn(Math, 'random').mockImplementation(() => {
			const value = rolls[idx % rolls.length];
			idx++;
			return value;
		});

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

	test('seeded RNG produces deterministic trip start results', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Sardine/Herring')!;
		const attempt = () =>
			calcFishingTripStart({
				gearBank: makeGearBank({ bank: new Bank().add('Fishing bait', 100).add('Spirit flakes', 100) }),
				fish,
				maxTripLength: 1_000_000,
				quantityInput: 25,
				wantsToUseFlakes: true,
				powerfish: false,
				hasWildyEliteDiary: false,
				rng: new SeedableRNG(123)
			});

		const res1 = attempt();
		const res2 = attempt();

		expect(typeof res1).toBe('object');
		expect(typeof res2).toBe('object');
		if (typeof res1 === 'string' || typeof res2 === 'string') {
			throw new Error('Expected deterministic trip start results');
		}

		expect(res1.duration).toBe(res2.duration);
		expect(res1.quantity).toBe(res2.quantity);
		expect(res1.catches).toStrictEqual(res2.catches);
		expect(res1.loot).toStrictEqual(res2.loot);
		expect(res1.blessingExtra).toBe(res2.blessingExtra);
		expect(res1.flakeExtra).toBe(res2.flakeExtra);
		expect(res1.flakesBeingUsed).toBe(res2.flakesBeingUsed);
		expect(res1.boosts).toStrictEqual(res2.boosts);
		expect(res1.isPowerfishing).toBe(res2.isPowerfishing);
		expect(res1.isUsingSpiritFlakes).toBe(res2.isUsingSpiritFlakes);
		expect(res1.spiritFlakePreference).toBe(res2.spiritFlakePreference);
		expect(res1.suppliesToRemove.equals(res2.suppliesToRemove)).toBe(true);
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

describe('calcFishingTripResult', () => {
	test('seeded RNG produces deterministic trip results', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Sardine/Herring')!;

		const attempt = () => {
			const gearBank = makeGearBank({
				bank: new Bank().add('Fishing bait', 100).add('Spirit flakes', 100)
			});
			const tripStart = calcFishingTripStart({
				gearBank,
				fish,
				maxTripLength: 1_000_000,
				quantityInput: 25,
				wantsToUseFlakes: true,
				powerfish: false,
				hasWildyEliteDiary: false,
				rng: new SeedableRNG(123)
			});
			if (typeof tripStart === 'string') {
				throw new Error('Expected deterministic trip start results');
			}

			const result = Fishing.util.calcFishingTripResult({
				fish,
				duration: tripStart.duration,
				catches: tripStart.catches,
				loot: tripStart.loot,
				gearBank,
				rng: new SeedableRNG(123),
				blessingExtra: tripStart.blessingExtra,
				flakeExtra: tripStart.flakeExtra,
				usedBarbarianCutEat: tripStart.usedBarbarianCutEat,
				isPowerfishing: tripStart.isPowerfishing
			});

			return { tripStart, result };
		};

		const run1 = attempt();
		const run2 = attempt();

		expect(run1.result.totalCatches).toBe(run2.result.totalCatches);
		expect(run1.result.messages).toStrictEqual(run2.result.messages);
		expect(run1.result.updateBank.itemLootBank.equals(run2.result.updateBank.itemLootBank)).toBe(true);
		expect(run1.result.updateBank.xpBank.xpList).toStrictEqual(run2.result.updateBank.xpBank.xpList);
		expect(run1.result.blessingExtra).toBe(run2.result.blessingExtra);
		expect(run1.result.flakeExtra).toBe(run2.result.flakeExtra);
	});

	test('reports blessing and flake gains in completion messages', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Sardine/Herring')!;
		const gearBank = makeGearBank({
			bank: new Bank().add('Fishing bait', 5).add('Spirit flakes', 5)
		});
		gearBank.gear.skilling.equip("Rada's blessing 4");

		const start = calcFishingTripStart({
			gearBank,
			fish,
			maxTripLength: 1_000_000,
			quantityInput: 1,
			wantsToUseFlakes: true,
			powerfish: false,
			hasWildyEliteDiary: false,
			rng: new SequenceRNG([0, 0, 0])
		});

		expect(typeof start).toBe('object');
		if (typeof start === 'string') {
			throw new Error('Expected trip start data');
		}

		expect(start.blessingExtra).toBeGreaterThanOrEqual(1);
		expect(start.flakeExtra).toBeGreaterThanOrEqual(1);

		const result = Fishing.util.calcFishingTripResult({
			fish,
			duration: start.duration,
			catches: start.catches,
			loot: start.loot,
			gearBank,
			rng: new SeedableRNG(5),
			blessingExtra: start.blessingExtra,
			flakeExtra: start.flakeExtra,
			usedBarbarianCutEat: start.usedBarbarianCutEat,
			isPowerfishing: start.isPowerfishing
		});

		expect(result.blessingExtra).toBe(start.blessingExtra);
		expect(result.flakeExtra).toBe(start.flakeExtra);
		expect(
			result.messages.some(msg => msg.includes("Rada's blessing") && msg.includes(start.blessingExtra.toString()))
		).toBe(true);
		expect(
			result.messages.some(msg => msg.includes('Spirit flakes') && msg.includes(start.flakeExtra.toString()))
		).toBe(true);
	});

	test('barbarian cut-eat flag persists even if cooking level increases mid-trip', () => {
		const fish = Fishing.Fishes.find(f => f.name === 'Barbarian fishing')!;
		const schedulingGear = makeGearBank({
			bank: new Bank().add('Feather', 200),
			skillsAsLevels: { fishing: 99, cooking: 79 }
		});

		const start = calcFishingTripStart({
			gearBank: schedulingGear,
			fish,
			maxTripLength: 30 * 60 * 1000,
			quantityInput: 100,
			wantsToUseFlakes: false,
			powerfish: true,
			hasWildyEliteDiary: false,
			rng: createDeterministicRNG(99)
		});
		expect(typeof start).toBe('object');
		if (typeof start === 'string') {
			throw new Error('Expected trip data when scheduling');
		}
		expect(start.usedBarbarianCutEat).toBe(false);

		const finishingGear = makeGearBank({
			bank: new Bank().add('Feather', 200),
			skillsAsLevels: { fishing: 99, cooking: 99 }
		});

		const result = Fishing.util.calcFishingTripResult({
			fish,
			duration: start.duration,
			catches: start.catches,
			loot: start.loot,
			gearBank: finishingGear,
			rng: createDeterministicRNG(99),
			usedBarbarianCutEat: start.usedBarbarianCutEat,
			isPowerfishing: start.isPowerfishing
		});

		expect(result.updateBank.xpBank.amount('cooking')).toBe(0);
	});
});
