import { Time } from '@oldschoolgg/toolkit';

import { TripError } from '@/lib/structures/TripError.js';
import type { ActivityTaskOptionsWithNoChanges } from '@/lib/types/minions.js';

export async function combatRingCommand({ user, channelId, rng }: OSInteraction) {
	if (await user.minionIsBusy()) {
		throw new TripError('Your minion is busy.', [user.id]);
	}

	await ActivityManager.startTrip<ActivityTaskOptionsWithNoChanges>({
		userID: user.id,
		channelId,
		duration: rng.randomVariation(Time.Minute * 5, 5),
		type: 'CombatRing'
	});

	return `${user.minionName} is now fighting in the Shayzien Combat Ring!`;
}
