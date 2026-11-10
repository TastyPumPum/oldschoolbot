import { sumArr, Time } from '@oldschoolgg/toolkit';

import { MAX_GLOBAL_QP, MAX_QP, quests } from '@/lib/minions/data/quests.js';
import { TripError } from '@/lib/structures/TripError.js';
import type { ActivityTaskOptionsWithNoChanges, SpecificQuestOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { hasSkillReqs } from '@/lib/util/smallUtils.js';

export async function questCommand(user: MUser, channelId: string, name?: string) {
	if (!user.hasMinion) {
		throw new TripError('You need a minion to do a questing trip', [user.id]);
	}
	if (await user.minionIsBusy()) {
		throw new TripError('Your minion must not be busy to do a questing trip', [user.id]);
	}

	if (name) {
		const quest = quests.find(q => q.name.toLowerCase() === name.toLowerCase());
		if (!quest) {
			throw new TripError(
				`That's not a valid quest, the quests you can do are: ${quests.map(q => q.name).join(', ')}.`,
				[user.id]
			);
		}

		if (user.user.finished_quest_ids.includes(quest.id)) {
			throw new TripError(`You've already completed ${quest.name}.`, [user.id]);
		}

		if (quest.qpReq) {
			if (user.QP < quest.qpReq) {
				throw new TripError(`You need ${quest.qpReq} QP to do ${quest.name}.`, [user.id]);
			}
		}

		// Check if the user has completed the required quests (if any)
		if (quest.prerequisitesQuests) {
			for (const prerequisite of quest.prerequisitesQuests) {
				if (!user.user.finished_quest_ids.includes(prerequisite)) {
					throw new TripError(
						`You need to complete "${quests.find(q => q.id === prerequisite)?.name}" before starting ${
							quest.name
						}.`,
						[user.id]
					);
				}
			}
		}

		if (quest.skillReqs) {
			const [hasReqs, reason] = hasSkillReqs(user, quest.skillReqs);
			if (!hasReqs) {
				throw new TripError(`To complete ${quest.name}, you need: ${reason}.`, [user.id]);
			}
		}
		if (user.isIronman && quest.ironmanSkillReqs) {
			const [hasIronReqs, ironReason] = hasSkillReqs(user, quest.ironmanSkillReqs);
			if (!hasIronReqs) {
				throw new TripError(`To complete ${quest.name} as an ironman, you need: ${ironReason}.`, [user.id]);
			}
		}

		const duration = quest.calcTime(user);

		await ActivityManager.startTrip<SpecificQuestOptions>({
			type: 'SpecificQuest',
			duration,
			userID: user.id,
			channelId,
			questID: quest.id
		});

		return `${user.minionName} is now completing ${quest.name}, they'll finish in around ${formatTripDuration(user, duration)}.`;
	}

	const currentQP = user.QP;
	if (currentQP >= MAX_QP) {
		throw new TripError('You already have the maximum amount of Quest Points.', [user.id]);
	}

	const qpFromUnfinishedQuests = sumArr(
		quests.filter(i => !user.user.finished_quest_ids.includes(i.id)).map(i => i.qp)
	);

	if (qpFromUnfinishedQuests > 0 && currentQP >= MAX_GLOBAL_QP) {
		throw new TripError(
			`You already have the maximum amount of Quest Points from doing quests, you can get ${qpFromUnfinishedQuests} more from specific quests.`,
			[user.id]
		);
	}

	const boosts = [];

	let duration = Time.Minute * 30;

	if (user.hasGracefulEquipped()) {
		duration *= 0.9;
		boosts.push('10% for Graceful');
	}

	await ActivityManager.startTrip<ActivityTaskOptionsWithNoChanges>({
		type: 'Questing',
		duration,
		userID: user.id,
		channelId: channelId.toString()
	});
	let response = `${user.minionName} is now completing quests, they'll come back in around ${formatTripDuration(user, duration)}.`;

	if (boosts.length > 0) {
		response += `\n\n**Boosts:** ${boosts.join(', ')}.`;
	}

	return response;
}
