import { formatDuration } from '@oldschoolgg/toolkit';

import {
	advanceMiscellaniaState,
	type MiscellaniaAreaKey,
	type MiscellaniaState,
	normalizeMiscellaniaState
} from '@/lib/miscellania/calc.js';
import type { MiscellaniaTopupActivityTaskOptions } from '@/lib/types/minions.js';

export const miscellaniaTopupTask: MinionTask = {
	type: 'MiscellaniaTopup',
	async run(data: MiscellaniaTopupActivityTaskOptions, { user, handleTripFinish }) {
		const { channelId, duration, primaryArea, secondaryArea } = data;
		const now = Date.now();
		const raw = await prisma.user.findUnique({
			where: { id: user.id },
			select: { miscellania_state: true }
		});
		const current = normalizeMiscellaniaState((raw?.miscellania_state as MiscellaniaState | null) ?? null, { now });
		const advanced = advanceMiscellaniaState(current, now);
		const nextState: MiscellaniaState = {
			...advanced,
			primaryArea: primaryArea as MiscellaniaAreaKey,
			secondaryArea: secondaryArea as MiscellaniaAreaKey,
			favour: 100,
			lastTopupAt: now
		};
		await prisma.user.update({
			where: { id: user.id },
			data: { miscellania_state: nextState as any }
		});

		handleTripFinish({
			user,
			channelId,
			message: `${user}, ${user.minionName} finished a Miscellania favour top-up trip (${formatDuration(
				duration
			)}). Favour restored to 100%.`,
			data
		});
	}
};
