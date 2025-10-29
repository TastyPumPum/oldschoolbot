import { getNextUTCReset, Time, toTitleCase } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

import type { MUser } from '@/lib/MUser.js';
import type { SkillNameType } from '@/lib/skilling/types.js';

export const BERT_SAND_ID = 'bert_sand' as const;
export const BERT_SAND_BUCKETS = 84;
export const BERT_SAND_DURATION = Time.Second * 15;
export const BERT_SAND_SKILL_REQS: readonly [SkillNameType, number][] = [
	['crafting', 49],
	['thieving', 17]
];
export const BERT_SAND_QP_REQUIRED = 5;
export const BERT_SAND_ITEM_ID = Items.getOrThrow('Bucket of sand').id;

export interface BertSandTripMetadata {
	lastCollectedAtStart: number;
}

export function isBertSandReady(lastCollected: number, now: number) {
	return now >= getNextUTCReset(lastCollected, Time.Day);
}

export function getBertSandRequirementError(user: MUser): string | null {
	if (user.QP < BERT_SAND_QP_REQUIRED) {
		return `You need at least ${BERT_SAND_QP_REQUIRED} Quest Points to collect sand for Bert.`;
	}

	for (const [skill, level] of BERT_SAND_SKILL_REQS) {
		if (user.skillsAsLevels[skill] < level) {
			return `You need level ${level} ${toTitleCase(skill)} to collect sand for Bert.`;
		}
	}

	return null;
}

export function meetsBertSandManualRequirements(user: MUser) {
	return getBertSandRequirementError(user) === null;
}

export function hasBertSandAutoDelivery(user: MUser) {
	return user.hasDiary('ardougne.elite');
}
