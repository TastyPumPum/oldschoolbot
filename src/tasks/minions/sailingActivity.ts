import { Events, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { skillEmoji } from '@/lib/data/emojis.js';
import { getMaxPortTasks, getPortTaskXPHour, SailingActivityById } from '@/lib/skilling/skills/sailing/activities.js';
import {
	type BarracudaRank,
	BarracudaTrialById,
	formatBarracudaRankObjectives,
	getBarracudaRank,
	getBarracudaTrialProgress,
	isBarracudaTrialId,
	setBarracudaTrialProgress
} from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import { rollOceanEncounters } from '@/lib/skilling/skills/sailing/encounters.js';
import {
	addStoredSalvage,
	SalvagingShipwreckById,
	type SalvagingShipwreckId
} from '@/lib/skilling/skills/sailing/salvaging.js';
import {
	getSeaChartingCompletionBonusesForTask,
	getSeaChartingCompletionGroupTasks,
	getSeaChartingCompletionKey,
	type SeaChartingTask,
	seaChartingTaskById,
	seaChartingTaskXP
} from '@/lib/skilling/skills/sailing/seaCharting.js';
import {
	getBarracudaTrialsProgress,
	getClaimedChartingCompletionBonuses,
	getClamItem,
	getCompletedChartingTaskIds,
	getInstalledFacilities,
	getOrCreateUserShip,
	getStoredSalvage,
	updateUpgradesBank
} from '@/lib/skilling/skills/sailing/ship.js';
import {
	getTrawlingCatchChance,
	TrawlingNetById,
	TrawlingShoalById,
	type TrawlingShoalId
} from '@/lib/skilling/skills/sailing/trawling.js';
import { calculatePassiveSailingActions } from '@/lib/skilling/skills/sailing/upgrades.js';
import type { SailingActivityTaskOptions } from '@/lib/types/minions.js';

async function rollSoup({
	user,
	loot,
	rng,
	rolls,
	chance,
	activity
}: {
	user: MUser;
	loot: Bank;
	rng: RNGProvider;
	rolls: number;
	chance: number;
	activity: string;
}) {
	if (user.owns('Soup') || loot.has('Soup')) return false;
	for (let i = 0; i < rolls; i++) {
		if (!rng.roll(chance)) continue;
		loot.add('Soup');
		globalClient.emit(
			Events.ServerNotification,
			`${skillEmoji.sailing} **${user.badgedUsername}'s** minion, ${user.minionName}, just received Soup while ${activity}!`
		);
		return true;
	}
	return false;
}

async function applyPassiveSailingActions({
	user,
	data,
	loot,
	rng
}: {
	user: MUser;
	data: SailingActivityTaskOptions;
	loot: Bank;
	rng: RNGProvider;
}) {
	const result = calculatePassiveSailingActions({
		duration: data.duration,
		sailingLevel: data.sailingLevel ?? user.skillsAsLevels.sailing,
		facilities: data.ship.facilities ?? []
	});
	await rollSoup({
		user,
		loot,
		rng,
		rolls: result.trims,
		chance: 120_000,
		activity: 'automatically trimming sails'
	});
	return result;
}

function formatPassiveSailingActions(result: ReturnType<typeof calculatePassiveSailingActions>) {
	const messages: string[] = [];
	if (result.trims > 0) {
		messages.push(`Sail trimming: ${result.trims.toLocaleString()} (+${result.trimXP.toLocaleString()} XP).`);
	}
	if (result.trimMoteXP > 0) {
		messages.push(
			`Wind motes: ${result.trims.toLocaleString()} released (+${result.trimMoteXP.toLocaleString()} XP).`
		);
	}
	if (result.extractorHarvests > 0) {
		messages.push(
			`Crystal extractor: ${result.extractorHarvests.toLocaleString()} harvests (+${result.extractorXP.toLocaleString()} XP).`
		);
	}
	if (result.extractorMoteXP > 0) {
		messages.push(
			`Extractor motes: ${result.extractorHarvests.toLocaleString()} released (+${result.extractorMoteXP.toLocaleString()} XP).`
		);
	}
	return messages;
}

function formatOceanEncounters(result: ReturnType<typeof rollOceanEncounters>) {
	if (result.encounters === 0) return [];
	const labels = {
		strong_winds: 'strong winds',
		mysterious_glow: 'mysterious glows',
		lost_crate: 'lost crates',
		castaway: 'castaways',
		giant_clam: 'giant clams',
		clue_turtle: 'clue turtles',
		ocean_man: 'Ocean Man',
		lost_casket: 'lost caskets'
	} as const;
	const breakdown = Object.entries(result.encounterCounts)
		.filter((entry): entry is [keyof typeof labels, number] => entry[1] !== undefined)
		.map(([encounter, count]) => `${count} ${labels[encounter]}`)
		.join(', ');
	return [
		`Ocean encounters: ${result.encounters.toLocaleString()} (+${result.xp.toLocaleString()} XP)${breakdown ? ` — ${breakdown}` : ''}.`
	];
}

export const sailingTask: MinionTask = {
	type: 'Sailing',
	async run(data: SailingActivityTaskOptions, { user, handleTripFinish, rng }) {
		const { activity: activityId, quantity, channelId, duration } = data;
		const activity = SailingActivityById.get(activityId);
		if (!activity) {
			throw new Error(`Unknown sailing activity: ${activityId}`);
		}

		if (activity.id === 'sea_charting') {
			const shipState = await getOrCreateUserShip(user.id);
			const completedTaskIds = new Set(getCompletedChartingTaskIds(shipState));
			const claimedCompletionBonuses = new Set(getClaimedChartingCompletionBonuses(shipState));
			const tasksCompleted = (data.chartingTaskIds ?? [])
				.map(id => seaChartingTaskById.get(id))
				.filter((task): task is SeaChartingTask => task !== undefined && !completedTaskIds.has(task.id));

			if (tasksCompleted.length === 0) {
				return handleTripFinish({
					user,
					channelId,
					message: `${user}, ${user.minionName} finished Sea charting, but had no new charting tasks to complete.`,
					data
				});
			}

			const nextCompletedTaskIds = new Set([...completedTaskIds, ...tasksCompleted.map(task => task.id)]);
			let xpReceived = tasksCompleted.reduce((total, task) => total + seaChartingTaskXP[task.type], 0);
			const completedBonusMessages: string[] = [];

			for (const task of tasksCompleted) {
				for (const bonus of getSeaChartingCompletionBonusesForTask(task)) {
					const completionKey = getSeaChartingCompletionKey(bonus);
					if (claimedCompletionBonuses.has(completionKey)) continue;
					const groupTasks = getSeaChartingCompletionGroupTasks(bonus);
					const completedCount = groupTasks.filter(t => nextCompletedTaskIds.has(t.id)).length;
					if (completedCount < Math.min(bonus.taskCount, groupTasks.length)) continue;
					xpReceived += bonus.xp;
					claimedCompletionBonuses.add(completionKey);
					completedBonusMessages.push(`${bonus.sea}: ${bonus.xp} XP`);
				}
			}

			await updateUpgradesBank(user.id, {
				completedChartingTaskIds: [...nextCompletedTaskIds],
				claimedChartingCompletionBonuses: [...claimedCompletionBonuses]
			});

			const loot = new Bank();
			const passiveActions = await applyPassiveSailingActions({ user, data, loot, rng });
			xpReceived += passiveActions.totalXP;
			const clam = getClamItem(shipState);
			const encounters = rollOceanEncounters({
				duration,
				sailingLevel: data.sailingLevel ?? user.skillsAsLevels.sailing,
				facilities: data.ship.facilities ?? [],
				clamItemId: clam.itemId,
				clamFedAt: clam.fedAt,
				user,
				rng
			});
			xpReceived += encounters.xp;
			loot.add(encounters.loot);
			if (encounters.clamConsumed) {
				await updateUpgradesBank(user.id, { clamItemId: null, clamFedAt: null });
			}
			await rollSoup({
				user,
				loot,
				rng,
				rolls: tasksCompleted.length,
				chance: 30_000,
				activity: 'Sea charting'
			});
			const xpRes = await user.addXP({
				skillName: 'sailing',
				amount: xpReceived,
				duration
			});

			let str = `${user}, ${user.minionName} finished Sea charting for ${tasksCompleted.length} tasks. ${xpRes}`;
			if (completedBonusMessages.length > 0) {
				str += `\nCompleted charting bonuses: ${completedBonusMessages.join(', ')}.`;
			}
			for (const message of formatPassiveSailingActions(passiveActions)) {
				str += `\n${message}`;
			}
			for (const message of formatOceanEncounters(encounters)) {
				str += `\n${message}`;
			}
			if (loot.length > 0) {
				await user.transactItems({ itemsToAdd: loot, collectionLog: true });
				str += `\nYou received: ${loot}.`;
			}

			return handleTripFinish({
				user,
				channelId,
				message: str,
				data,
				loot: loot.length > 0 ? loot : null
			});
		}

		if (isBarracudaTrialId(activity.id)) {
			const trial = BarracudaTrialById.get(activity.id)!;
			const rank = getBarracudaRank(trial, data.variant);
			if (!rank) {
				throw new Error(`Unknown Barracuda Trial rank: ${data.variant}`);
			}

			const shipState = await getOrCreateUserShip(user.id);
			const barracudaProgress = getBarracudaTrialsProgress(shipState);
			const trialProgress = getBarracudaTrialProgress(barracudaProgress, trial.id);
			const completedRanks = new Set(trialProgress.completedRanks);
			const newlyCompletedRank = !completedRanks.has(rank.id);
			if (newlyCompletedRank) {
				completedRanks.add(rank.id);
			}
			const bestTime = trialProgress.bestTimes[rank.id];
			const nextBestTimes = {
				...trialProgress.bestTimes,
				[rank.id]: bestTime ? Math.min(bestTime, rank.targetTime) : rank.targetTime
			};

			const loot = new Bank();
			if (newlyCompletedRank) {
				loot.add(rank.reward);
			}
			if (rank.id === 'marlin') {
				for (let i = 0; i < quantity; i++) {
					if (rng.roll(trial.paintChance)) {
						loot.add('Barracuda paint');
					}
				}
			}
			await rollSoup({
				user,
				loot,
				rng,
				rolls: quantity,
				chance: rank.petChance,
				activity: `${trial.name} at ${rank.name} rank`
			});
			const passiveActions = await applyPassiveSailingActions({ user, data, loot, rng });
			const clam = getClamItem(shipState);
			const encounters = rollOceanEncounters({
				duration,
				sailingLevel: data.sailingLevel ?? user.skillsAsLevels.sailing,
				facilities: data.ship.facilities ?? [],
				clamItemId: clam.itemId,
				clamFedAt: clam.fedAt,
				user,
				rng
			});
			loot.add(encounters.loot);
			if (encounters.clamConsumed) {
				await updateUpgradesBank(user.id, { clamItemId: null, clamFedAt: null });
			}

			await updateUpgradesBank(user.id, {
				barracudaTrials: setBarracudaTrialProgress(
					barracudaProgress,
					trial.id,
					[...completedRanks] as BarracudaRank[],
					nextBestTimes
				)
			});

			const xpReceived =
				quantity * rank.xp + (newlyCompletedRank ? rank.bonusXP : 0) + passiveActions.totalXP + encounters.xp;
			const xpRes = await user.addXP({
				skillName: 'sailing',
				amount: xpReceived,
				duration
			});

			let str = `${user}, ${user.minionName} completed ${trial.name} at ${rank.name} rank ${quantity}x. ${xpRes}`;
			const objectives = formatBarracudaRankObjectives(rank);
			if (objectives) {
				str += `\nObjectives completed: ${objectives}.`;
			}
			if (newlyCompletedRank) {
				str += `\nNew rank achieved: ${rank.name}. Bonus XP: ${rank.bonusXP.toLocaleString()}.`;
			}
			for (const message of formatPassiveSailingActions(passiveActions)) {
				str += `\n${message}`;
			}
			for (const message of formatOceanEncounters(encounters)) {
				str += `\n${message}`;
			}
			if (loot.length > 0) {
				await user.transactItems({
					itemsToAdd: loot,
					collectionLog: true
				});
				str += `\nYou received: ${loot}.`;
			}

			return handleTripFinish({
				user,
				channelId,
				message: str,
				data,
				loot: loot.length > 0 ? loot : null
			});
		}

		if (activity.id === 'port_tasks') {
			const variant = data.variant === 'bounty' ? 'bounty' : 'courier';
			const sailingLevel = data.sailingLevel ?? user.skillsAsLevels.sailing;
			const xpPerHour = getPortTaskXPHour(variant, sailingLevel);
			const taskXP = Math.floor((duration / Time.Hour) * xpPerHour);
			const loot = new Bank().add('Coins', taskXP);
			for (let i = 0; i < quantity; i++) {
				if (rng.roll(36)) loot.add('Shark paint');
			}
			await rollSoup({
				user,
				loot,
				rng,
				rolls: quantity,
				chance: 6000,
				activity: variant === 'bounty' ? 'completing bounty tasks' : 'delivering courier cargo'
			});
			const passiveActions = await applyPassiveSailingActions({ user, data, loot, rng });
			const shipState = await getOrCreateUserShip(user.id);
			const clam = getClamItem(shipState);
			const encounters = rollOceanEncounters({
				duration,
				sailingLevel,
				facilities: data.ship.facilities ?? [],
				clamItemId: clam.itemId,
				clamFedAt: clam.fedAt,
				user,
				rng
			});
			loot.add(encounters.loot);
			if (encounters.clamConsumed) {
				await updateUpgradesBank(user.id, { clamItemId: null, clamFedAt: null });
			}
			const xpRes = await user.addXP({
				skillName: 'sailing',
				amount: taskXP + passiveActions.totalXP + encounters.xp,
				duration
			});
			await user.transactItems({ itemsToAdd: loot, collectionLog: true });

			let str = `${user}, ${user.minionName} finished ${quantity.toLocaleString()} ${variant} task cycles (${getMaxPortTasks(sailingLevel)} task slots, ~${xpPerHour.toLocaleString()} base XP/hr). ${xpRes}\nYou received: ${loot}.`;
			for (const message of formatPassiveSailingActions(passiveActions)) {
				str += `\n${message}`;
			}
			for (const message of formatOceanEncounters(encounters)) {
				str += `\n${message}`;
			}
			return handleTripFinish({
				user,
				channelId,
				message: str,
				data,
				loot
			});
		}

		if (activity.id === 'shipwreck_salvaging') {
			const shipwreck = SalvagingShipwreckById.get(data.variant as SalvagingShipwreckId);
			if (!shipwreck) {
				throw new Error(`Unknown salvaging shipwreck: ${data.variant}`);
			}

			const shipState = await getOrCreateUserShip(user.id);
			const salvageXP = Math.floor(quantity * shipwreck.salvagingXP);
			const loot = new Bank();
			const hasSalvagingStation = getInstalledFacilities(shipState).includes('salvaging_station');
			let sortingXP = 0;
			if (hasSalvagingStation) {
				sortingXP = Math.floor(quantity * shipwreck.sortingXP);
				loot.add(shipwreck.lootTable.roll(quantity));
				const soupQuantity = loot.amount('Soup');
				if (user.owns('Soup') && soupQuantity > 0) {
					loot.remove('Soup', soupQuantity);
				} else if (soupQuantity > 1) {
					loot.remove('Soup', soupQuantity - 1);
				}
				if (!user.owns('Soup') && soupQuantity > 0) {
					globalClient.emit(
						Events.ServerNotification,
						`${skillEmoji.sailing} **${user.badgedUsername}'s** minion, ${user.minionName}, just received Soup while sorting salvage at sea!`
					);
				}
			} else {
				const nextSalvage = addStoredSalvage(getStoredSalvage(shipState), shipwreck.id, quantity);
				await updateUpgradesBank(user.id, { salvage: nextSalvage });
			}
			const passiveActions = await applyPassiveSailingActions({ user, data, loot, rng });
			const xpRes = await user.addXP({
				skillName: 'sailing',
				amount: salvageXP + sortingXP + passiveActions.totalXP,
				duration
			});

			let str = `${user}, ${user.minionName} finished salvaging ${quantity}x ${shipwreck.name}. ${xpRes}`;
			str += hasSalvagingStation
				? `\nThe salvaging station sorted ${quantity.toLocaleString()}x ${shipwreck.salvageName} while at sea.`
				: `\nStored salvage: ${quantity.toLocaleString()}x ${shipwreck.salvageName}.`;
			for (const message of formatPassiveSailingActions(passiveActions)) {
				str += `\n${message}`;
			}
			if (loot.length > 0) {
				await user.transactItems({ itemsToAdd: loot, collectionLog: true });
				str += `\nYou received: ${loot}.`;
			}

			return handleTripFinish({
				user,
				channelId,
				message: str,
				data,
				loot: loot.length > 0 ? loot : null
			});
		}

		if (activity.id === 'deep_sea_trawling') {
			const shoal = TrawlingShoalById.get(data.variant as TrawlingShoalId);
			const net = data.trawlingNet ? TrawlingNetById.get(data.trawlingNet) : undefined;
			if (!shoal || !net) {
				throw new Error(`Invalid deep sea trawling setup: ${data.variant}/${data.trawlingNet}`);
			}

			const loot = new Bank();
			let successfulCatches = 0;
			const catchChance = getTrawlingCatchChance(shoal, user.skillsAsLevels.fishing);
			for (let i = 0; i < quantity; i++) {
				if (rng.randInt(1, 10_000) > Math.round(catchChance * 100)) continue;
				successfulCatches++;
				loot.add(shoal.fish, rng.randInt(1, net.maxFishPerCatch));
				if (rng.roll(18_000)) loot.add("Angler's paint");
			}
			await rollSoup({
				user,
				loot,
				rng,
				rolls: quantity,
				chance: 360_000,
				activity: `deep sea trawling at ${shoal.name}`
			});
			const passiveActions = await applyPassiveSailingActions({ user, data, loot, rng });
			const sailingXP = quantity * net.sailingXP + passiveActions.totalXP;
			const fishingXP = successfulCatches * shoal.fishingXP;
			const sailingXPRes = await user.addXP({ skillName: 'sailing', amount: sailingXP, duration });
			const fishingXPRes = await user.addXP({ skillName: 'fishing', amount: fishingXP, duration });

			let str = `${user}, ${user.minionName} finished ${quantity.toLocaleString()} trawling rolls at ${shoal.name}. ${sailingXPRes}\n${fishingXPRes}\nSuccessful catches: ${successfulCatches.toLocaleString()} (${catchChance.toFixed(2)}%).`;
			for (const message of formatPassiveSailingActions(passiveActions)) {
				str += `\n${message}`;
			}
			if (loot.length > 0) {
				await user.transactItems({ itemsToAdd: loot, collectionLog: true });
				str += `\nYou received: ${loot}.`;
			}
			return handleTripFinish({
				user,
				channelId,
				message: str,
				data,
				loot: loot.length > 0 ? loot : null
			});
		}

		throw new Error(`Sailing activity has no result handler: ${activity.id}`);
	}
};
