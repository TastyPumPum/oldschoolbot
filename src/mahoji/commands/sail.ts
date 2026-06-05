import { formatDuration } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { QuestID } from '@/lib/minions/data/quests.js';
import { SailingActivities, SailingActivityById } from '@/lib/skilling/skills/sailing/activities.js';
import { SailingDifficulties, SailingDifficultyById } from '@/lib/skilling/skills/sailing/difficulties.js';
import { SailingFacilitiesById } from '@/lib/skilling/skills/sailing/facilities.js';
import { getOrCreateUserShip, getShipPartTier, hasFacility, snapshotShip } from '@/lib/skilling/skills/sailing/ship.js';
import { calcSailingTripStart } from '@/lib/skilling/skills/sailing/util.js';
import type { SailingActivityTaskOptions } from '@/lib/types/minions.js';

export const sailCommand = defineCommand({
	name: 'sail',
	description: 'Send your minion on a Sailing activity.',
	attributes: {
		requiresMinion: true,
		requiresMinionNotBusy: true,
		examples: ['/sail activity:Port contracts']
	},
	options: [
		{
			type: 'String',
			name: 'activity',
			description: 'The Sailing activity to do.',
			required: true,
			choices: SailingActivities.map(activity => ({
				name: activity.name,
				value: activity.id
			}))
		},
		{
			type: 'String',
			name: 'variant',
			description: 'Activity variant (e.g. courier, bounty, swordfish, shark, marlin).',
			required: false,
			choices: [
				...new Set(SailingActivities.flatMap(activity => activity.variants?.map(variant => variant.id) ?? []))
			].map(v => ({ name: v, value: v }))
		},
		{
			type: 'String',
			name: 'difficulty',
			description: 'Activity difficulty.',
			required: false,
			choices: SailingDifficulties.map(difficulty => ({
				name: difficulty.name,
				value: difficulty.id
			}))
		},
		{
			type: 'Integer',
			name: 'quantity',
			description: 'The number of actions to perform (optional).',
			required: false,
			min_value: 1
		}
	],
	run: async ({ options, user, channelId }) => {
		const hasPandemonium = user.user.finished_quest_ids?.includes(QuestID.Pandemonium) ?? false;
		if (!hasPandemonium) {
			return `${user.minionName} needs to have completed the Pandemonium quest to access the sailing skill.
			\n You can complete this quest by using the command: \`/activities quest name:Pandemonium\``;
		}
		const activity = SailingActivityById.get(options.activity);
		if (!activity) return 'That is not a valid Sailing activity.';

		const variant = options.variant ?? activity.variants?.[0]?.id;
		if (variant && !activity.variants?.some(v => v.id === variant)) {
			return 'That is not a valid variant for this activity.';
		}

		const difficulty = SailingDifficultyById.get(
			options.difficulty ?? activity.allowedDifficulties?.[0] ?? 'standard'
		);
		if (!difficulty) return 'That is not a valid Sailing difficulty.';
		if (activity.allowedDifficulties && !activity.allowedDifficulties.includes(difficulty.id)) {
			return `${activity.name} cannot be done at ${difficulty.name} difficulty.`;
		}
		if (activity.id === 'sea_charting' && difficulty.id === 'standard') {
			const hasCurrentAffairs = user.user.finished_quest_ids?.includes(QuestID.CurrentAffairs) ?? false;
			if (!hasCurrentAffairs) {
				return `${user.minionName} needs to complete the Current Affairs quest to do Sea charting at Standard difficulty.`;
			}
		}

		if (user.skillsAsLevels.sailing < activity.level) {
			return `${user.minionName} needs ${activity.level} Sailing to do ${activity.name}.`;
		}
		if (activity.qpRequired && user.QP < activity.qpRequired) {
			return `${user.minionName} needs ${activity.qpRequired} QP to do ${activity.name}.`;
		}

		const ship = await getOrCreateUserShip(user.id);
		if (activity.requiredFacility && !hasFacility(ship, activity.requiredFacility)) {
			const facility = SailingFacilitiesById.get(activity.requiredFacility);
			return `${activity.name} requires the ${facility?.name ?? activity.requiredFacility} facility. Install it with /ship install.`;
		}
		if (activity.requiredShipTiers) {
			for (const [part, tier] of Object.entries(activity.requiredShipTiers)) {
				const currentTier = getShipPartTier(ship, part as 'hull' | 'sails' | 'crew' | 'navigation' | 'cargo');
				if (currentTier < (tier ?? 1)) {
					return `Your ${part} tier is too low for ${activity.name}. You need ${part} tier ${tier}.`;
				}
			}
		}
		if (activity.requiredItems && activity.requiredItems.length > 0) {
			const requiredBank = new Bank();
			for (const itemName of activity.requiredItems) requiredBank.add(itemName);
			if (!user.owns(requiredBank)) {
				return `You need to own ${activity.requiredItems.join(', ')} to do ${activity.name}.`;
			}
		}
		const shipSnapshot = snapshotShip(ship);

		const maxTripLength = await user.calcMaxTripLength('Sailing');

		const variantData = variant ? activity.variants?.find(v => v.id === variant) : undefined;
		const { quantity, duration, boosts } = calcSailingTripStart({
			activity,
			maxTripLength,
			quantityInput: options.quantity,
			ship: shipSnapshot,
			timeMultiplier: (variantData?.timeMultiplier ?? 1) * difficulty.timeMultiplier
		});

		await ActivityManager.startTrip<SailingActivityTaskOptions>({
			userID: user.id,
			channelId,
			duration,
			type: 'Sailing',
			activity: activity.id,
			quantity,
			iQty: options.quantity ? options.quantity : undefined,
			ship: shipSnapshot,
			sailingLevel: user.skillsAsLevels.sailing,
			difficulty: difficulty.id,
			variant
		});

		let response = `${user.minionName} is now doing ${activity.name}${
			variantData ? ` (${variantData.name})` : ''
		} at ${difficulty.name} difficulty (${quantity} actions), it'll take around ${formatDuration(duration)} to finish.`;

		if (boosts.length > 0) {
			response += `\n\n**Boosts:** ${boosts.join(', ')}.`;
		}

		return response;
	}
});
