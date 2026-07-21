import { describe, expect, test } from 'vitest';

import { makeShipImage } from '@/lib/canvas/shipImage.js';

describe('Ship Image', () => {
	test.each(['raft', 'skiff', 'sloop'] as const)('renders %s ship image', async shipType => {
		const result = await makeShipImage(shipType);
		expect(result.length).toBeGreaterThan(0);
	});
});
