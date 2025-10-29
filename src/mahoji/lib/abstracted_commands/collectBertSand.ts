import { formatDuration, getNextUTCReset, sleep, Time, toTitleCase } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { SkillNameType } from '@/lib/skilling/types.js';

export const BERT_SAND_ID = 'bert_sand' as const;
const BERT_SAND_BUCKETS = 84;
const BERT_SAND_SKILL_REQS: readonly [SkillNameType, number][] = [
	['crafting', 49],
	['thieving', 17]
];
const BERT_SAND_QP_REQUIRED = 5;

function isBertSandReady(lastCollected: number, now: number) {
	return now >= getNextUTCReset(lastCollected, Time.Day);
}

export async function collectBertSand(user: MUser, interaction: MInteraction | null) {
	const now = Date.now();
	const stats = await user.fetchStats();
	const lastCollected = Number(stats.last_bert_sand_timestamp ?? 0n);

	if (user.QP < BERT_SAND_QP_REQUIRED) {
		return `You need at least ${BERT_SAND_QP_REQUIRED} Quest Points to collect sand for Bert.`;
	}

	for (const [skill, level] of BERT_SAND_SKILL_REQS) {
		if (user.skillsAsLevels[skill] < level) {
			return `You need level ${level} ${toTitleCase(skill)} to collect sand for Bert.`;
		}
	}

	if (!isBertSandReady(lastCollected, now)) {
		const nextReset = getNextUTCReset(lastCollected, Time.Day);
		return `Bert will have more buckets of sand for you in ${formatDuration(nextReset - now)}.`;
	}

	if (interaction) {
		await interaction.defer();
	}

	await sleep(Time.Second * 15);

	const refreshedStats = await user.fetchStats();
	const refreshedLastCollected = Number(refreshedStats.last_bert_sand_timestamp ?? 0n);
	if (refreshedLastCollected > lastCollected) {
		const nextReset = getNextUTCReset(refreshedLastCollected, Time.Day);
		return `Bert already delivered your buckets of sand. You can collect again in ${formatDuration(
			nextReset - Date.now()
		)}.`;
	}

	const loot = new Bank({ 'Bucket of sand': BERT_SAND_BUCKETS });
	await user.addItemsToBank({ items: loot, collectionLog: false });
	await user.statsUpdate({ last_bert_sand_timestamp: Date.now() });

	return `You collect ${BERT_SAND_BUCKETS.toLocaleString()} Buckets of sand from Bert and add them to your bank.`;
}
