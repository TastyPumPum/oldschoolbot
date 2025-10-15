import type { Item } from 'oldschooljs';
import { describe, expect, it, vi } from 'vitest';

import type { MUser } from '@/lib/MUser.js';

vi.mock('@/lib/canvas/OSRSCanvas.js', () => {
	class FakeOSRSCanvas {
		public static getItemImage = vi.fn(async () => ({ width: 36, height: 32 }));
		public width: number;
		public height: number;
		public ctx = { drawImage: vi.fn() };

		constructor({ width, height }: { width: number; height: number }) {
			this.width = width;
			this.height = height;
		}

		async toBuffer() {
			return Buffer.from('fake');
		}
	}

	return { OSRSCanvas: FakeOSRSCanvas };
});

vi.mock('@oldschoolgg/toolkit', () => ({
	Time: { Second: 1000 }
}));

import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';

const { buildHighRollerResponse, calculatePayouts, generateUniqueRolls } = await import(
	'@/mahoji/lib/abstracted_commands/highRollerCommand.js'
);

const dummyItem = { id: 1, name: 'Dummy item' } as Item;

describe('calculatePayouts', () => {
	it('distributes pot to a single winner when using winner takes all', () => {
		expect(calculatePayouts({ pot: 100_000_000, participantCount: 5, mode: 'winner_takes_all' })).toStrictEqual([
			100_000_000
		]);
	});

	it('splits the pot among the top 3 with the 60/30/10 ratio', () => {
		expect(calculatePayouts({ pot: 100, participantCount: 3, mode: 'top_three' })).toStrictEqual([60, 30, 10]);
	});

	it('normalises payouts when fewer than three players join', () => {
		expect(calculatePayouts({ pot: 90, participantCount: 2, mode: 'top_three' })).toStrictEqual([60, 30]);
	});

	it('awards any rounding remainder to the winner', () => {
		expect(calculatePayouts({ pot: 101, participantCount: 3, mode: 'top_three' })).toStrictEqual([61, 30, 10]);
	});
});

describe('generateUniqueRolls', () => {
	it('rerolls duplicate values until every entry is unique', () => {
		const responses = [
			{ item: dummyItem, value: 5 },
			{ item: dummyItem, value: 5 },
			{ item: dummyItem, value: 10 },
			{ item: dummyItem, value: 11 },
			{ item: dummyItem, value: 12 }
		];
		let idx = 0;
		const results = generateUniqueRolls({
			count: 3,
			rollFn: () => {
				if (idx >= responses.length) {
					throw new Error('test roll queue exhausted');
				}
				return responses[idx++]!;
			}
		});
		expect(results).toHaveLength(3);
		const values = results.map(result => result.value);
		expect(new Set(values).size).toBe(3);
		expect(values.sort((a, b) => a - b)).toStrictEqual([10, 11, 12]);
	});
});

describe('buildHighRollerResponse', () => {
	it('includes fallback attachments when no emoji is available', async () => {
		const originalGetItemEmoji = (globalThis as { getItemEmoji?: (itemID: number) => string | null }).getItemEmoji;
		(globalThis as { getItemEmoji?: (itemID: number) => string | null }).getItemEmoji = () => null;

		const itemCanvas = new OSRSCanvas({ width: 36, height: 32 });
		const getItemImageSpy = vi.spyOn(OSRSCanvas, 'getItemImage').mockResolvedValue(itemCanvas.getCanvas());

		const response = await buildHighRollerResponse({
			mode: 'winner_takes_all',
			stake: 1_000_000,
			pot: 1_000_000,
			rollResults: [
				{
					user: { badgedUsername: 'Tester' } as unknown as MUser,
					item: dummyItem,
					value: 5_000
				}
			],
			payoutsMessages: []
		});

		expect(response.files).toBeDefined();
		const files = (response.files ?? []) as { name?: string }[];
		expect(files).toHaveLength(1);
		expect(files[0]!.name).toBe('item-1.png');

		const rollEmbed = response.embeds?.[1];
		const rollEmbedData = typeof rollEmbed?.toJSON === 'function' ? rollEmbed.toJSON() : rollEmbed;
		const rollDescription =
			(rollEmbedData as { description?: string } | undefined)?.description ??
			(rollEmbedData as { data?: { description?: string } } | undefined)?.data?.description ??
			'';
		expect(rollDescription).toContain('![Dummy item](attachment://item-1.png)');

		getItemImageSpy.mockRestore();
		if (originalGetItemEmoji) {
			(globalThis as { getItemEmoji?: (itemID: number) => string | null }).getItemEmoji = originalGetItemEmoji;
		} else {
			delete (globalThis as { getItemEmoji?: (itemID: number) => string | null }).getItemEmoji;
		}
	});
});
