import { describe, expect, it } from 'vitest';

import { getActivityLogSummary } from '../../src/lib/ActivityManager.js';
import type { Activity } from '../../src/prisma/main.js';

describe('getActivityLogSummary', () => {
	it('summarises combined auto farming by patch groups', () => {
		const activity = {
			type: 'Farming',
			data: {
				autoFarmCombined: true,
				autoFarmPlan: [{ patchName: 'herb' }, { patchName: 'tree' }, { patchName: 'fruit_tree' }],
				plantsName: 'Torstol',
				quantity: 10
			}
		} as unknown as Activity;

		expect(getActivityLogSummary(activity)).toBe(': AutoFarming x3 patch groups');
	});

	it('keeps crop summaries for normal farming trips', () => {
		const activity = {
			type: 'Farming',
			data: {
				plantsName: 'Torstol',
				quantity: 10
			}
		} as unknown as Activity;

		expect(getActivityLogSummary(activity)).toBe(': Torstol x10');
	});
});
