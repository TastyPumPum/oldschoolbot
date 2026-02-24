import { formatDuration } from '@oldschoolgg/toolkit';

import type { MiscellaniaAreaKey, MiscellaniaState } from '@/lib/miscellania/calc.js';
import type { MiscellaniaTopupActivityTaskOptions } from '@/lib/types/minions.js';

export const miscellaniaTopupTask: MinionTask = {
	type: 'MiscellaniaTopup',
	async run(data: MiscellaniaTopupActivityTaskOptions, { user, handleTripFinish }) {
		const {
			channelId,
			duration,
			primaryArea,
			secondaryArea,
			days,
			gpCost,
			endingCoffer,
			endingFavourBeforeTopup,
			endingResourcePoints,
			royalTrouble
		} = data;
		const nextState: MiscellaniaState = {
			lastClaimedAt: Date.now(),
			primaryArea: primaryArea as MiscellaniaAreaKey,
			secondaryArea: secondaryArea as MiscellaniaAreaKey,
			coffer: endingCoffer,
			favour: 100,
			resourcePoints: endingResourcePoints,
			royalTrouble
		};
		await prisma.user.update({
			where: { id: user.id },
			data: { miscellania_state: nextState as any }
		});

		handleTripFinish({
			user,
			channelId,
			message: `${user}, ${user.minionName} finished Managing Miscellania (${formatDuration(
				duration
			)}). Claimed ${days} day${days === 1 ? '' : 's'} worth for ${gpCost.toLocaleString()} GP. Coffer is now ${endingCoffer.toLocaleString()}, favour before top-up was ${endingFavourBeforeTopup.toFixed(
				1
			)}%, and total resource points are ${endingResourcePoints.toLocaleString()}.`,
			data
		});
	}
};
