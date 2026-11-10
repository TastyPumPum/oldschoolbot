import { Time } from '@oldschoolgg/toolkit';
import { Bank, ItemGroups } from 'oldschooljs';

import { TripError } from '@/lib/structures/TripError.js';
import type { MinigameActivityTaskOptionsWithNoChanges } from '@/lib/types/minions.js';

export async function championsChallengeCommand({ user, channelId, rng }: OSInteraction) {
	if (await user.minionIsBusy()) {
		throw new TripError('Your minion is busy.', [user.id]);
	}

	const { bank } = user;
	if (!bank.has(ItemGroups.championScrolls)) {
		throw new TripError(
			"You don't have a set of Champion Scrolls to do the Champion's Challenge! You need 1 of each.",
			[user.id]
		);
	}

	const cost = new Bank();
	for (const id of ItemGroups.championScrolls) cost.add(id);
	await user.transactItems({ itemsToRemove: cost });

	await ActivityManager.startTrip<MinigameActivityTaskOptionsWithNoChanges>({
		userID: user.id,
		channelId,
		quantity: 1,
		duration: rng.randomVariation(Time.Minute * 20, 5),
		type: 'ChampionsChallenge',
		minigameID: 'champions_challenge'
	});

	return `${user.minionName} is now doing the Champion's Challenge! Removed 1x of every Champion scroll from your bank.`;
}
