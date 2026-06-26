import { formatDuration } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { SailingActivities, SailingActivityById } from '@/lib/skilling/skills/sailing/activities.js';
import {
	type BarracudaRank,
	BarracudaTrialById,
	formatBarracudaRankObjectives,
	getBarracudaRank,
	getBarracudaTrialProgress,
	getPreviousBarracudaRank,
	isBarracudaTrialId
} from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import { SailingFacilitiesById } from '@/lib/skilling/skills/sailing/facilities.js';
import { canGainSailingXP } from '@/lib/skilling/skills/sailing/sailingXPUnlock.js';
import {
	getBestSalvagingShipwreckForLevel,
	SalvagingShipwreckById,
	type SalvagingShipwreckId
} from '@/lib/skilling/skills/sailing/salvaging.js';
import { getEligibleSeaChartingTasks } from '@/lib/skilling/skills/sailing/seaCharting.js';
import {
	getBarracudaTrialsProgress,
	getCompletedChartingTaskIds,
	getInstalledFacilities,
	getOrCreateUserShip,
	hasFacility,
	snapshotShip
} from '@/lib/skilling/skills/sailing/ship.js';
import {
	canTrawlAtDepth,
	getBestInstalledTrawlingNet,
	TrawlingNetById,
	type TrawlingNetId,
	TrawlingShoalById,
	type TrawlingShoalId
} from '@/lib/skilling/skills/sailing/trawling.js';
import { calcSailingTripStart } from '@/lib/skilling/skills/sailing/util.js';
import type { SailingActivityTaskOptions } from '@/lib/types/minions.js';
import { makeStartQuestButton } from '@/lib/util/interactions.js';

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
			type: 'Integer',
			name: 'quantity',
			description: 'The number of actions to perform (optional).',
			required: false,
			min_value: 1
		}
	],
	run: async ({ options, user, channelId }) => {
		if (!canGainSailingXP(user)) {
			return {
				content: `${user.minionName} needs to have completed the Pandemonium quest to access the sailing skill.\n\nYou can complete this quest by using the command: \`/activities quest name:Pandemonium\``,
				components: [makeStartQuestButton('Pandemonium')]
			};
		}
		const activity = SailingActivityById.get(options.activity);
		if (!activity) return 'That is not a valid Sailing activity.';

		const variant =
			options.variant ??
			(activity.id === 'shipwreck_salvaging'
				? getBestSalvagingShipwreckForLevel(user.skillsAsLevels.sailing)?.id
				: activity.variants?.[0]?.id);
		if (variant && !activity.variants?.some(v => v.id === variant)) {
			return 'That is not a valid variant for this activity.';
		}

		if (user.skillsAsLevels.sailing < activity.level) {
			return `${user.minionName} needs ${activity.level} Sailing to do ${activity.name}.`;
		}
		if (activity.id === 'shipwreck_salvaging') {
			const shipwreck = SalvagingShipwreckById.get(variant as SalvagingShipwreckId);
			if (!shipwreck) return `${user.minionName} needs ${activity.level} Sailing to do ${activity.name}.`;
			if (user.skillsAsLevels.sailing < shipwreck.level) {
				return `${user.minionName} needs ${shipwreck.level} Sailing to salvage from ${shipwreck.name}.`;
			}
		}
		if (activity.id === 'port_tasks' && variant === 'bounty' && user.skillsAsLevels.sailing < 30) {
			return `${user.minionName} needs 30 Sailing to do bounty tasks.`;
		}
		if (isBarracudaTrialId(activity.id)) {
			const trial = BarracudaTrialById.get(activity.id);
			const rank = trial ? getBarracudaRank(trial, variant) : undefined;
			if (!trial || !rank) return 'That is not a valid Barracuda Trial rank.';
			if (trial.mimickedQuestRequirement) {
				const requirement = trial.mimickedQuestRequirement;
				const missingRequirements: string[] = [];
				if (requirement.qpReq && user.QP < requirement.qpReq) {
					missingRequirements.push(`${requirement.qpReq} QP`);
				}
				for (const [skill, level] of Object.entries(requirement.skillReqs ?? {})) {
					if (user.skillsAsLevels[skill as keyof typeof user.skillsAsLevels] < level) {
						missingRequirements.push(`${level} ${skill}`);
					}
				}
				if (missingRequirements.length > 0) {
					return `${trial.name} requires ${requirement.name} requirements: ${missingRequirements.join(', ')}.`;
				}
			}
		}
		if (activity.qpRequired && user.QP < activity.qpRequired) {
			return `${user.minionName} needs ${activity.qpRequired} QP to do ${activity.name}.`;
		}

		const ship = await getOrCreateUserShip(user.id);
		if (activity.requiredFacility && !hasFacility(ship, activity.requiredFacility)) {
			const facility = SailingFacilitiesById.get(activity.requiredFacility);
			return `${activity.name} requires the ${facility?.name ?? activity.requiredFacility} facility. Install it with \`/ship install\`.`;
		}
		if (
			activity.requiredAnyFacilities &&
			!activity.requiredAnyFacilities.some(facility => hasFacility(ship, facility))
		) {
			const facilities = activity.requiredAnyFacilities.map(
				facility => SailingFacilitiesById.get(facility)?.name ?? facility
			);
			return `${activity.name} requires one of these facilities: ${facilities.join(', ')}. Install one with \`/ship install\`.`;
		}
		if (activity.requiredItems && activity.requiredItems.length > 0) {
			const requiredBank = new Bank();
			for (const itemName of activity.requiredItems) requiredBank.add(itemName);
			if (!user.owns(requiredBank)) {
				return `You need to own ${activity.requiredItems.join(', ')} to do ${activity.name}.`;
			}
		}
		const shipSnapshot = snapshotShip(ship);
		let trawlingNet: TrawlingNetId | undefined;

		if (activity.id === 'deep_sea_trawling') {
			const shoal = TrawlingShoalById.get(variant as TrawlingShoalId);
			if (!shoal) return 'That is not a valid trawling shoal.';
			if (user.skillsAsLevels.fishing < shoal.fishingLevel) {
				return `${user.minionName} needs ${shoal.fishingLevel} Fishing to trawl at ${shoal.name}.`;
			}
			const net = getBestInstalledTrawlingNet(getInstalledFacilities(ship));
			if (!net) return 'Deep sea trawling requires a trawling net.';
			if (!canTrawlAtDepth(net, shoal.depth)) {
				return `${shoal.name} requires a net capable of trawling at ${shoal.depth} depth.`;
			}
			trawlingNet = net.id;
		}

		const maxTripLength = await user.calcMaxTripLength('Sailing');

		const variantData = variant ? activity.variants?.find(v => v.id === variant) : undefined;
		if (isBarracudaTrialId(activity.id)) {
			const trial = BarracudaTrialById.get(activity.id)!;
			const rank = getBarracudaRank(trial, variant)!;
			const progress = getBarracudaTrialProgress(getBarracudaTrialsProgress(ship), trial.id);
			const completedRanks = new Set(progress.completedRanks);
			const previousRank = getPreviousBarracudaRank(rank.id);
			if (previousRank && !completedRanks.has(previousRank)) {
				const previousRankName =
					trial.ranks.find(trialRank => trialRank.id === previousRank)?.name ?? previousRank;
				return `${user.minionName} needs to complete ${trial.name} at ${previousRankName} rank before attempting ${rank.name} rank.`;
			}

			const maxQuantity = Math.max(1, Math.floor(maxTripLength / rank.targetTime));
			const quantity = Math.min(options.quantity ?? maxQuantity, maxQuantity);
			const duration = quantity * rank.targetTime;

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
				variant: rank.id satisfies BarracudaRank
			});

			let response = `${user.minionName} is now attempting ${trial.name} at ${rank.name} rank (${quantity} completions), it'll take around ${formatDuration(
				duration
			)} to finish.`;
			const objectives = formatBarracudaRankObjectives(rank);
			if (objectives) {
				response += `\nObjectives: ${objectives}.`;
			}
			if (trial.unsupportedRequirementNotes?.length) {
				response += `\nOSRS requirements not checked by the bot yet: ${trial.unsupportedRequirementNotes.join(' ')}`;
			}
			return response;
		}

		if (activity.id === 'sea_charting') {
			const eligibleTasks = getEligibleSeaChartingTasks(user, getCompletedChartingTaskIds(ship));
			if (eligibleTasks.length === 0) {
				return `${user.minionName} has no eligible Sea charting tasks to complete right now.`;
			}

			const requestedQuantity = Math.min(options.quantity ?? eligibleTasks.length, eligibleTasks.length);
			const chartingTrip = calcSailingTripStart({
				activity,
				maxTripLength,
				quantityInput: requestedQuantity
			});
			const selectedTasks = eligibleTasks.slice(0, chartingTrip.quantity);

			await ActivityManager.startTrip<SailingActivityTaskOptions>({
				userID: user.id,
				channelId,
				duration: chartingTrip.duration,
				type: 'Sailing',
				activity: activity.id,
				quantity: chartingTrip.quantity,
				iQty: options.quantity ? options.quantity : undefined,
				ship: shipSnapshot,
				sailingLevel: user.skillsAsLevels.sailing,
				chartingTaskIds: selectedTasks.map(task => task.id)
			});

			return `${user.minionName} is now doing Sea charting (${chartingTrip.quantity} tasks), it'll take around ${formatDuration(
				chartingTrip.duration
			)} to finish.`;
		}

		if (activity.id === 'deep_sea_trawling') {
			const maxQuantity = Math.max(1, Math.floor(maxTripLength / activity.baseTime));
			const quantity = Math.min(options.quantity ?? maxQuantity, maxQuantity);
			const duration = quantity * activity.baseTime;
			const shoal = TrawlingShoalById.get(variant as TrawlingShoalId)!;

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
				variant,
				trawlingNet
			});

			return `${user.minionName} is now deep sea trawling at ${shoal.name} with ${TrawlingNetById.get(trawlingNet!)?.name} (${quantity.toLocaleString()} rolls), it'll take around ${formatDuration(duration)} to finish.`;
		}

		const quantityInput = options.quantity;
		const { quantity: tripQuantity, duration: tripDuration } = calcSailingTripStart({
			activity,
			maxTripLength,
			quantityInput,
			timeMultiplier: variantData?.timeMultiplier ?? 1
		});

		await ActivityManager.startTrip<SailingActivityTaskOptions>({
			userID: user.id,
			channelId,
			duration: tripDuration,
			type: 'Sailing',
			activity: activity.id,
			quantity: tripQuantity,
			iQty: quantityInput,
			ship: shipSnapshot,
			sailingLevel: user.skillsAsLevels.sailing,
			variant,
			trawlingNet
		});

		return `${user.minionName} is now doing ${activity.name}${
			variantData ? ` (${variantData.name})` : ''
		} (${tripQuantity} actions), it'll take around ${formatDuration(tripDuration)} to finish.`;
	}
});
