import { formatDuration, getNextUTCReset, Time } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

import { ActivityManager } from '@/lib/ActivityManager.js';
import {
	BERT_SAND_BUCKETS,
	BERT_SAND_DURATION,
	BERT_SAND_ITEM_ID,
	getBertSandRequirementError,
	isBertSandReady
} from '@/lib/minions/data/bertSand.js';
import type { CollectingOptions } from '@/lib/types/minions.js';

const bertSandCollectable = Items.getOrThrow('Bucket of sand');

export async function collectBertSand(user: MUser, channelID: string) {
	const now = Date.now();
	const stats = await user.fetchStats();
	const lastCollected = Number(stats.last_bert_sand_timestamp ?? 0n);

	const requirementError = getBertSandRequirementError(user);
	if (requirementError) {
		return requirementError;
	}

	if (!isBertSandReady(lastCollected, now)) {
		const nextReset = getNextUTCReset(lastCollected, Time.Day);
		return `Bert will have more buckets of sand for you in ${formatDuration(nextReset - now)}.`;
	}

	await ActivityManager.startTrip<CollectingOptions>({
		collectableID: BERT_SAND_ITEM_ID,
		userID: user.id,
		channelID,
		quantity: 1,
		duration: BERT_SAND_DURATION,
		type: 'Collecting',
		lootQuantityOverride: BERT_SAND_BUCKETS,
		bertSand: { lastCollectedAtStart: lastCollected }
	});

	return `${user.minionName} is now collecting ${BERT_SAND_BUCKETS.toLocaleString()}x ${
		bertSandCollectable.name
	}, it'll take around ${formatDuration(BERT_SAND_DURATION)} to finish.`;
}
