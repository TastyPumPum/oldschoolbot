import { formatDuration } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { SailingActivityById, type SailingActivityId } from '@/lib/skilling/skills/sailing/activities.js';
import {
	type BarracudaRank,
	BarracudaRankOrder,
	BarracudaTrialById,
	BarracudaTrials,
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
	type SalvagingShipwreckId,
	SalvagingShipwrecks
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
	type TrawlingShoalId,
	TrawlingShoals
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
		examples: ['/sail port_tasks type:Courier tasks']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'sea_charting',
			description: 'Complete eligible Sea charting tasks.',
			options: [
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The number of tasks to complete (optional).',
					required: false,
					min_value: 1
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'port_tasks',
			description: 'Complete port courier or bounty tasks.',
			options: [
				{
					type: 'String',
					name: 'type',
					description: 'The type of port task to complete.',
					required: true,
					choices: [
						{ name: 'Courier tasks', value: 'courier' },
						{ name: 'Bounty tasks', value: 'bounty' }
					]
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The number of task cycles to complete (optional).',
					required: false,
					min_value: 1
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'shipwreck_salvaging',
			description: 'Salvage from shipwrecks.',
			options: [
				{
					type: 'String',
					name: 'shipwreck',
					description: 'The shipwreck to salvage. Defaults to your best option.',
					required: false,
					choices: SalvagingShipwrecks.map(shipwreck => ({
						name: shipwreck.name,
						value: shipwreck.id
					}))
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The number of salvages to perform (optional).',
					required: false,
					min_value: 1
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'barracuda_trial',
			description: 'Attempt a Barracuda Trial.',
			options: [
				{
					type: 'String',
					name: 'trial',
					description: 'The Barracuda Trial to attempt.',
					required: true,
					choices: BarracudaTrials.map(trial => ({
						name: trial.name,
						value: trial.id
					}))
				},
				{
					type: 'String',
					name: 'rank',
					description: 'The rank to attempt.',
					required: true,
					choices: BarracudaRankOrder.map(rank => ({
						name: rank,
						value: rank
					}))
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The number of completions to attempt (optional).',
					required: false,
					min_value: 1
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'deep_sea_trawling',
			description: 'Trawl at deep sea shoals.',
			options: [
				{
					type: 'String',
					name: 'shoal',
					description: 'The shoal to trawl.',
					required: true,
					choices: TrawlingShoals.map(shoal => ({
						name: shoal.name,
						value: shoal.id
					}))
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The number of trawling rolls to perform (optional).',
					required: false,
					min_value: 1
				}
			]
		}
	],
	run: async ({ options, user, channelId }) => {
		if (!canGainSailingXP(user)) {
			return {
				content: `${user.minionName} needs to have completed the Pandemonium quest to access the sailing skill.\n\nYou can complete this quest by using the command: \`/activities quest name:Pandemonium\``,
				components: [makeStartQuestButton('Pandemonium')]
			};
		}

		let activityId: SailingActivityId | undefined;
		let variant: string | undefined;
		let quantityInput: number | undefined;

		if (options.sea_charting) {
			activityId = 'sea_charting';
			quantityInput = options.sea_charting.quantity;
		} else if (options.port_tasks) {
			activityId = 'port_tasks';
			variant = options.port_tasks.type;
			quantityInput = options.port_tasks.quantity;
		} else if (options.shipwreck_salvaging) {
			activityId = 'shipwreck_salvaging';
			variant =
				options.shipwreck_salvaging.shipwreck ??
				getBestSalvagingShipwreckForLevel(user.skillsAsLevels.sailing)?.id;
			quantityInput = options.shipwreck_salvaging.quantity;
		} else if (options.barracuda_trial) {
			activityId = options.barracuda_trial.trial as SailingActivityId;
			variant = options.barracuda_trial.rank;
			quantityInput = options.barracuda_trial.quantity;
		} else if (options.deep_sea_trawling) {
			activityId = 'deep_sea_trawling';
			variant = options.deep_sea_trawling.shoal;
			quantityInput = options.deep_sea_trawling.quantity;
		}

		if (!activityId) return 'Invalid Sailing subcommand.';
		const activity = SailingActivityById.get(activityId);
		if (!activity) return 'That is not a valid Sailing activity.';

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
			const quantity = Math.min(quantityInput ?? maxQuantity, maxQuantity);
			const duration = quantity * rank.targetTime;

			await ActivityManager.startTrip<SailingActivityTaskOptions>({
				userID: user.id,
				channelId,
				duration,
				type: 'Sailing',
				activity: activity.id,
				quantity,
				iQty: quantityInput ? quantityInput : undefined,
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

			const requestedQuantity = Math.min(quantityInput ?? eligibleTasks.length, eligibleTasks.length);
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
				iQty: quantityInput ? quantityInput : undefined,
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
			const quantity = Math.min(quantityInput ?? maxQuantity, maxQuantity);
			const duration = quantity * activity.baseTime;
			const shoal = TrawlingShoalById.get(variant as TrawlingShoalId)!;

			await ActivityManager.startTrip<SailingActivityTaskOptions>({
				userID: user.id,
				channelId,
				duration,
				type: 'Sailing',
				activity: activity.id,
				quantity,
				iQty: quantityInput ? quantityInput : undefined,
				ship: shipSnapshot,
				sailingLevel: user.skillsAsLevels.sailing,
				variant,
				trawlingNet
			});

			return `${user.minionName} is now deep sea trawling at ${shoal.name} with ${TrawlingNetById.get(trawlingNet!)?.name} (${quantity.toLocaleString()} rolls), it'll take around ${formatDuration(duration)} to finish.`;
		}

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
