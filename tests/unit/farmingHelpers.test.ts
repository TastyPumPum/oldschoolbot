import { describe, expect, it } from 'vitest';

import './setup.js';

import { Farming } from '@/lib/skilling/skills/farming/index.js';
import {
	findPlant,
	getFarmingKeyFromName,
	hasAnyReadyPatch,
	isPatchName
} from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';

describe('farming helpers', () => {
	it('identifies valid farming patch names', () => {
		expect(isPatchName('herb')).toBe(true);
		expect(isPatchName('not-a-real-patch')).toBe(false);
	});

	it('maps patch names to settings keys', () => {
		expect(getFarmingKeyFromName('tree')).toBe('farmingPatches_tree');
	});

	it('finds plants by name or alias', () => {
		const guam = Farming.Plants.find(plant => plant.name === 'Guam');
		expect(guam).toBeDefined();

		const plantByName = findPlant('Guam');
		const plantByAlias = findPlant('guam weed');

		expect(plantByName?.name).toBe('Guam');
		expect(plantByAlias?.name).toBe('Guam');
	});

	it('detects whether any patches are ready to harvest', () => {
		expect(hasAnyReadyPatch([{ ready: false } as any, { ready: null } as any, { ready: true } as any])).toBe(true);

		expect(hasAnyReadyPatch([{ ready: false } as any, { ready: null } as any])).toBe(false);
	});
});
