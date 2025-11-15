import { convertLVLtoXP } from 'oldschooljs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import './setup.js';

import * as rng from '@oldschoolgg/rng';

import { getPlantToGrow } from '@/lib/skilling/skills/farming/utils/calcFarmingContracts.js';
import { mockMUser } from './userutil.js';

describe('calcFarmingContracts', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('selects an easy contract plant when the user meets requirements', () => {
		const user = mockMUser({
			skills_farming: convertLVLtoXP(60)
		});

		vi.spyOn(rng, 'randArrItem').mockReturnValue([45, 'Potato', 1]);

		const [plantName, tier] = getPlantToGrow({
			user,
			contractLevel: 'easy',
			ignorePlant: null
		});

		expect(plantName).toBe('Potato');
		expect(tier).toBe(1);
	});

	it('respects the requested difficulty when picking a plant', () => {
		const user = mockMUser({
			skills_farming: convertLVLtoXP(90)
		});

		vi.spyOn(rng, 'randArrItem').mockReturnValue([85, 'Palm tree', 4]);

		const [plantName, tier] = getPlantToGrow({
			user,
			contractLevel: 'medium',
			ignorePlant: 'Jangerberry'
		});

		expect(plantName).toBe('Palm tree');
		expect(tier).toBe(4);
	});

	it('throws when there is no suitable plant for the players level', () => {
		const user = mockMUser({
			skills_farming: convertLVLtoXP(1)
		});

		expect(() =>
			getPlantToGrow({
				user,
				contractLevel: 'hard',
				ignorePlant: null
			})
		).toThrow();
	});
});
