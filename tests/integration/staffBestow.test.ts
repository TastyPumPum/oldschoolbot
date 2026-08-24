import { SpecialResponse } from '@oldschoolgg/discord';
import { Bank, EItem } from 'oldschooljs';
import { describe, expect, it, vi } from 'vitest';

import { sendStaffBestowReward } from '@/lib/staffBestow.js';
import { mockInteraction } from '../test-utils/mockInteraction.js';
import { createTestUser } from './util.js';

describe('staff bestow', () => {
	it("adds bestowed items to the recipient's collection log", async () => {
		const admin = await createTestUser();
		const recipient = await createTestUser();
		const reward = new Bank().add(EItem.ABYSSAL_WHIP);
		await admin.update({ rp_bestow_bank: reward.toJSON() });

		const getStaffGrantsScheduleSpy = vi.spyOn(Cache, 'getStaffGrantsSchedule').mockResolvedValue({
			daily: {
				[admin.id]: reward.toJSON()
			}
		});

		try {
			const result = await sendStaffBestowReward({
				user: admin,
				rawReward: EItem.ABYSSAL_WHIP.toString(),
				recipient,
				guildId: null,
				interaction: mockInteraction({ user: admin })
			});

			expect(result).toBe(SpecialResponse.RespondedManually);
			expect(recipient.bank.amount(EItem.ABYSSAL_WHIP)).toBe(1);
			expect(recipient.cl.amount(EItem.ABYSSAL_WHIP)).toBe(1);
			expect((await recipient.fetchCL()).amount(EItem.ABYSSAL_WHIP)).toBe(1);
		} finally {
			getStaffGrantsScheduleSpy.mockRestore();
		}
	});
});
