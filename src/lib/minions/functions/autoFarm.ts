import { ButtonBuilder, ButtonStyle, SpecialResponse } from '@oldschoolgg/discord';
import { Emoji, formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { CropUpgradeType } from '@/prisma/main/enums.js';
import { AutoFarmFilterEnum, activity_type_enum } from '@/prisma/main/enums.js';
import { InteractionID } from '@/lib/InteractionID.js';
import { allFarm, replant } from '@/lib/minions/functions/autoFarmFilters.js';
import {
	getPlantsForPatch,
	parsePreferredSeeds,
	resolveSeedForPatch
} from '@/lib/skilling/skills/farming/autoFarm/preferences.js';
import { plants } from '@/lib/skilling/skills/farming/index.js';
import {
	farmingBoostMessages,
	formatFarmingBoosts,
	formatItemsUsed
} from '@/lib/skilling/skills/farming/utils/farmingFormatters.js';
import type { FarmingPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type { IPatchData, IPatchDataDetailed } from '@/lib/skilling/skills/farming/utils/types.js';
import type { Plant } from '@/lib/skilling/types.js';
import type { AutoFarmStepData, FarmingActivityTaskOptions } from '@/lib/types/minions.js';
import addSubTaskToActivityTask from '@/lib/util/addSubTaskToActivityTask.js';
import { calcMaxTripLength } from '@/lib/util/calcMaxTripLength.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { fetchRepeatTrips, repeatTrip } from '@/lib/util/repeatStoredTrip.js';
import { prepareFarmingStep } from './farmingTripHelpers.js';

interface PlannedAutoFarmStep {
	plant: Plant;
	quantity: number;
	duration: number;
	travelPatchCount: number;
	upgradeType: CropUpgradeType | null;
	didPay: boolean;
	treeChopFee: number;
	patch: IPatchData;
	patchName: FarmingPatchName;
	friendlyName: string;
	info: string[];
	boosts: string[];
}

interface PlanRequest {
	type: 'highest' | 'plant';
	patch: IPatchDataDetailed;
	plant?: Plant;
}

interface BuildSummaryResult {
	summaryLine: string;
	extraInfoLines: string[];
}

interface SharedPatchLocation {
	name: string;
	patches: Partial<Record<FarmingPatchName, number>>;
}

const sharedAllotmentFlowerHerbLocations: SharedPatchLocation[] = [
	{ name: 'South Falador', patches: { allotment: 2, flower: 1, herb: 1 } },
	{ name: 'West of Port Phasmatys', patches: { allotment: 2, flower: 1, herb: 1 } },
	{ name: 'Catherby', patches: { allotment: 2, flower: 1, herb: 1 } },
	{ name: 'North of Ardougne', patches: { allotment: 2, flower: 1, herb: 1 } },
	{ name: 'Hosidius', patches: { allotment: 2, flower: 1, herb: 1 } },
	{ name: 'Harmony Island', patches: { allotment: 1, herb: 1 } },
	{ name: 'Farming Guild', patches: { allotment: 2, flower: 1, herb: 1 } },
	{ name: 'Prifddinas', patches: { allotment: 2, flower: 1 } },
	{ name: 'Troll Stronghold', patches: { herb: 1 } },
	{ name: 'Weiss', patches: { herb: 1 } },
	{ name: 'Ortus Farm', patches: { allotment: 2, flower: 1, herb: 1 } },
	{ name: 'Kastori', patches: { flower: 1 } }
];

function shouldHideInfoLine(line: string): boolean {
	const normalized = line.toLowerCase();
	return (
		normalized.startsWith('you are treating your patches with') ||
		normalized.startsWith('you are paying a nearby farmer') ||
		normalized.startsWith('you may need to pay a nearby farmer')
	);
}

function buildSummaryForStep(index: number, step: PlannedAutoFarmStep): BuildSummaryResult {
	const extraInfoLines = step.info
		.filter(infoLine => !shouldHideInfoLine(infoLine))
		.map(infoLine => `${step.friendlyName}: ${infoLine}`);

	return {
		summaryLine: `${index + 1}. ${step.friendlyName}: ${step.quantity.toLocaleString()}x ${step.plant.name}`,
		extraInfoLines
	};
}

function farmingTimeBoostMultiplier(boosts: string[]): number {
	let multiplier = 1;
	if (boosts.includes(farmingBoostMessages.gracefulTime)) multiplier *= 0.9;
	if (boosts.includes(farmingBoostMessages.ringOfEnduranceTime)) multiplier *= 0.9;
	if (boosts.includes(farmingBoostMessages.ardougneHardTime)) multiplier *= 0.96;
	if (boosts.includes(farmingBoostMessages.ardougneEliteTime)) multiplier *= 0.96;
	return multiplier;
}

function allocateSharedLocationVisits(step: PlannedAutoFarmStep) {
	const allocations: { step: PlannedAutoFarmStep; patchCount: number; locationIndex: number }[] = [];
	let remainingPatchCount = step.travelPatchCount;

	for (const [locationIndex, location] of sharedAllotmentFlowerHerbLocations.entries()) {
		if (remainingPatchCount <= 0) {
			break;
		}

		const locationPatchCount = location.patches[step.patchName] ?? 0;
		if (locationPatchCount <= 0) {
			continue;
		}

		const patchCount = Math.min(remainingPatchCount, locationPatchCount);
		allocations.push({ step, patchCount, locationIndex });
		remainingPatchCount -= patchCount;
	}

	return allocations;
}

function calculateSharedLocationTiming(plannedSteps: PlannedAutoFarmStep[]) {
	const stepSavings = new Map<PlannedAutoFarmStep, number>();
	const allocationsByLocation = new Map<
		number,
		{ step: PlannedAutoFarmStep; patchCount: number; locationIndex: number }[]
	>();

	for (const step of plannedSteps) {
		for (const allocation of allocateSharedLocationVisits(step)) {
			const allocations = allocationsByLocation.get(allocation.locationIndex) ?? [];
			allocations.push(allocation);
			allocationsByLocation.set(allocation.locationIndex, allocations);
		}
	}

	for (const allocations of allocationsByLocation.values()) {
		const patchTypesAtLocation = new Set(allocations.map(allocation => allocation.step.patchName));
		if (patchTypesAtLocation.size < 2) {
			continue;
		}

		let hasKeptTravelVisit = false;
		for (const allocation of allocations) {
			let savedPatchTravelCount = allocation.patchCount;
			if (!hasKeptTravelVisit) {
				savedPatchTravelCount -= 1;
				hasKeptTravelVisit = true;
			}
			if (savedPatchTravelCount <= 0) {
				continue;
			}

			const effectiveTravelTime =
				allocation.step.plant.timePerPatchTravel *
				Time.Second *
				farmingTimeBoostMultiplier(allocation.step.boosts);
			stepSavings.set(
				allocation.step,
				(stepSavings.get(allocation.step) ?? 0) + savedPatchTravelCount * effectiveTravelTime
			);
		}
	}

	const stepDurations = plannedSteps.map(step => Math.max(1, step.duration - (stepSavings.get(step) ?? 0)));
	const totalDuration = stepDurations.reduce((total, duration) => total + duration, 0);
	const totalSavedDuration = [...stepSavings.values()].reduce((total, duration) => total + duration, 0);

	return { stepDurations, totalDuration, totalSavedDuration };
}

async function tryRepeatPreviousTrip({
	user,
	interaction,
	errorString
}: {
	user: MUser;
	interaction: MInteraction;
	errorString: string;
}): Promise<CommandResponse | null> {
	try {
		const repeatableTrips = await fetchRepeatTrips(user);
		const fallbackTrip = repeatableTrips.find(trip => trip.type !== activity_type_enum.Farming);
		if (!fallbackTrip) {
			return null;
		}
		const response = await repeatTrip(user, interaction as OSInteraction, fallbackTrip);
		if (response === SpecialResponse.SilentErrorResponse || response === SpecialResponse.PaginatedMessageResponse) {
			return response;
		}
		if (typeof response === 'string') {
			return `${errorString}\n\n${response}`;
		}
		if (response && typeof response === 'object' && 'content' in response && typeof response.content === 'string') {
			return { ...response, content: `${errorString}\n\n${response.content}` };
		}
		return response;
	} catch (err) {
		Logging.logError(err as Error);
		return null;
	}
}

export async function autoFarm(
	user: MUser,
	patchesDetailed: IPatchDataDetailed[],
	patches: Record<FarmingPatchName, IPatchData>,
	interaction: MInteraction
) {
	if (await user.minionIsBusy()) {
		return 'Your minion must not be busy to use this command.';
	}

	const farmingLevel = user.skillsAsLevels.farming;

	const autoFarmFilter = user.autoFarmFilter ?? AutoFarmFilterEnum.AllFarm;
	const preferContract = Boolean(user.user.minion_farmingPreferredContract);
	const preferredSeeds = parsePreferredSeeds(user.user.minion_farmingPreferredSeeds);

	const baseBank = user.bank.clone().add('Coins', user.GP);

	const eligiblePlants = [...plants]
		.filter(p => {
			switch (autoFarmFilter) {
				case AutoFarmFilterEnum.AllFarm:
					return allFarm(p, farmingLevel, user, user.bank);
				case AutoFarmFilterEnum.Replant:
					return replant(p, farmingLevel, user, user.bank, patchesDetailed);
				default:
					return allFarm(p, farmingLevel, user, user.bank);
			}
		})
		.sort((a, b) => b.level - a.level);

	const maxTripLength = await calcMaxTripLength(user, 'Farming');
	const compostTier = ((user.user.minion_defaultCompostToUse as CropUpgradeType) ?? 'compost') as CropUpgradeType;

	const plannedSteps: PlannedAutoFarmStep[] = [];
	let totalDuration = 0;
	const totalCost = new Bank();
	const remainingBank = baseBank.clone();
	let skippedDueToTripLength = false;
	const skippedPatchNamesDueToTripLength = new Set<string>();

	const hasPreferenceInfluence = preferContract || preferredSeeds.size > 0;
	let errorString =
		autoFarmFilter === AutoFarmFilterEnum.AllFarm
			? "There's no Farming crops that you have the requirements to plant, and nothing to harvest."
			: "There's no Farming crops that you have planted that are ready to be replanted or no seeds remaining.";
	if (hasPreferenceInfluence) {
		errorString = "There's no Farming actions available for your saved preferences.";
	}

	let firstPrepareError: string | null = null;

	const patchesByName = new Map<FarmingPatchName, IPatchDataDetailed>(
		patchesDetailed.map(patch => [patch.patchName, patch])
	);
	const fallbackPlantsByPatch = new Map<FarmingPatchName, Plant>();
	for (const plant of eligiblePlants) {
		const patchName = plant.seedType as FarmingPatchName;
		if (fallbackPlantsByPatch.has(patchName)) {
			continue;
		}
		const patch = patchesByName.get(patchName);
		if (!patch || patch.ready === false) {
			continue;
		}
		fallbackPlantsByPatch.set(patchName, plant);
	}

	const contract = user.farmingContract();
	const hasActiveContract = Boolean(contract.contract?.hasContract);
	const contractPlant =
		hasActiveContract && contract.contract?.plantToGrow
			? (contract.plant ??
				(contract.contract?.plantToGrow ? plants.find(pl => pl.name === contract.contract?.plantToGrow) : null))
			: null;

	const planRequests: PlanRequest[] = [];
	for (const patch of patchesDetailed) {
		const resolved = resolveSeedForPatch({
			patch,
			preferContract,
			hasActiveContract,
			contractPlant: contractPlant ?? null,
			preferences: preferredSeeds,
			fallbackPlant: fallbackPlantsByPatch.get(patch.patchName) ?? null
		});

		if (!resolved) {
			continue;
		}

		if (resolved.type === 'plant') {
			const planRequest: PlanRequest = { type: 'plant', patch, plant: resolved.plant };
			if (resolved.reason === 'contract') {
				// Always attempt the contract patch first when contract priority is enabled.
				planRequests.unshift(planRequest);
			} else {
				planRequests.push(planRequest);
			}
			continue;
		}

		planRequests.push({ type: 'highest', patch });
	}

	for (const request of planRequests) {
		const patch = request.patch;
		const candidates =
			request.type === 'highest' ? getPlantsForPatch(patch.patchName) : request.plant ? [request.plant] : [];
		const levelEligibleCandidates = candidates.filter(candidate => candidate.level <= farmingLevel);
		if (levelEligibleCandidates.length === 0) {
			continue;
		}

		let planned = false;
		const errorsForPatch: string[] = [];
		for (const candidate of levelEligibleCandidates) {
			const prepared = await prepareFarmingStep({
				user,
				plant: candidate,
				quantity: null,
				pay: false,
				patchDetailed: patch,
				maxTripLength,
				availableBank: remainingBank,
				compostTier
			});
			if (!prepared.success) {
				errorsForPatch.push(prepared.error);
				continue;
			}

			const { quantity, duration, travelPatchCount, cost, upgradeType, didPay, infoStr, boostStr, treeChopFee } =
				prepared.data;
			if (quantity <= 0 || duration <= 0) {
				continue;
			}
			if (duration > maxTripLength) {
				errorsForPatch.push(
					`${user.minionName} can't go on trips longer than ${formatDuration(maxTripLength)}.`
				);
				continue;
			}
			const totalCoinCost = cost.amount('Coins') + treeChopFee;
			if (totalCoinCost > 0 && remainingBank.amount('Coins') < totalCoinCost) {
				errorsForPatch.push(`You don't own ${new Bank().add('Coins', totalCoinCost)}.`);
				continue;
			}
			if (!remainingBank.has(cost)) {
				errorsForPatch.push(`You don't own ${cost}.`);
				continue;
			}
			const patchData = patches[patch.patchName];
			if (!patchData) {
				errorsForPatch.push(`Unable to resolve patch data for ${patch.friendlyName}.`);
				break;
			}

			const plannedStep: PlannedAutoFarmStep = {
				plant: candidate,
				quantity,
				duration,
				travelPatchCount,
				upgradeType,
				didPay,
				treeChopFee,
				patch: patchData,
				patchName: patch.patchName,
				friendlyName: patch.friendlyName,
				info: infoStr,
				boosts: boostStr
			};
			const timingWithStep = calculateSharedLocationTiming([...plannedSteps, plannedStep]);
			if (timingWithStep.totalDuration > maxTripLength) {
				skippedDueToTripLength = true;
				skippedPatchNamesDueToTripLength.add(patch.friendlyName);
				continue;
			}

			remainingBank.remove(cost);
			if (treeChopFee > 0) {
				const treeFeeBank = new Bank().add('Coins', treeChopFee);
				remainingBank.remove(treeFeeBank);
				totalCost.add(treeFeeBank);
			}
			totalCost.add(cost);
			totalDuration = timingWithStep.totalDuration;
			plannedSteps.push(plannedStep);
			planned = true;
			break;
		}

		if (!planned && errorsForPatch.length > 0 && !firstPrepareError) {
			firstPrepareError = errorsForPatch[0];
		}
	}

	if (plannedSteps.length === 0) {
		if (firstPrepareError !== null) {
			return firstPrepareError;
		}

		const checkPatchesButton = new ButtonBuilder()
			.setCustomId(InteractionID.Commands.CheckPatches)
			.setLabel('Check Patches')
			.setEmoji({ name: Emoji.Stopwatch })
			.setStyle(ButtonStyle.Secondary);

		const components: ButtonBuilder[] = [checkPatchesButton];

		const noCropsResponse = new MessageBuilder().setContent(errorString).addComponents(components);

		const repeated = await tryRepeatPreviousTrip({ user, interaction, errorString });
		if (repeated !== null) {
			return repeated;
		}

		return noCropsResponse;
	}

	const sharedLocationTiming = calculateSharedLocationTiming(plannedSteps);
	totalDuration = sharedLocationTiming.totalDuration;

	const autoFarmPlan: AutoFarmStepData[] = [];
	const planningStartTime = Date.now();
	let accumulatedDuration = 0;
	for (const [index, step] of plannedSteps.entries()) {
		const duration = sharedLocationTiming.stepDurations[index] ?? step.duration;
		autoFarmPlan.push({
			plantsName: step.plant.name,
			quantity: step.quantity,
			upgradeType: step.upgradeType,
			patchName: step.patchName,
			payment: step.didPay,
			treeChopFeePaid: step.treeChopFee,
			treeChopFeePlanned: step.treeChopFee,
			patchType: step.patch,
			planting: true,
			currentDate: planningStartTime + accumulatedDuration,
			duration
		});
		accumulatedDuration += duration;
	}

	const firstStep = autoFarmPlan[0];
	if (!firstStep) {
		return errorString;
	}

	const channelId = interaction.channelId;
	const firstTask = {
		userID: user.id,
		type: 'Farming',
		duration: totalDuration,
		channelId,
		plantsName: firstStep.plantsName,
		patchType: firstStep.patchType,
		quantity: firstStep.quantity,
		upgradeType: firstStep.upgradeType,
		payment: firstStep.payment,
		treeChopFeePaid: firstStep.treeChopFeePaid,
		treeChopFeePlanned: firstStep.treeChopFeePlanned,
		planting: firstStep.planting,
		autoFarmed: true,
		autoFarmCombined: autoFarmPlan.length > 1,
		autoFarmPlan,
		currentDate: firstStep.currentDate,
		patchName: firstStep.patchName
	} satisfies Omit<FarmingActivityTaskOptions, 'finishDate' | 'id'>;

	let chargedCost = false;
	try {
		if (!user.owns(totalCost)) {
			return `You don't own ${totalCost}.`;
		}
		if (totalCost.length > 0) {
			await user.transactItems({ itemsToRemove: totalCost });
			chargedCost = true;
		}
		await addSubTaskToActivityTask(firstTask);
	} catch (err) {
		const startFailContext = { type: 'AUTO_FARM_START_FAIL', user_id: user.id, charged_cost: chargedCost };
		if ((globalThis as { prisma?: unknown }).prisma) {
			Logging.logError(err as Error, startFailContext);
		} else {
			Logging.logDebug(`AutoFarm failed to start for ${user.id}: ${(err as Error).message}`, startFailContext);
		}
		if (chargedCost && totalCost.length > 0) {
			try {
				await user.transactItems({ itemsToAdd: totalCost });
			} catch (refundErr) {
				Logging.logError(refundErr as Error);
			}
		}
		if (err instanceof Error) {
			return err.message;
		}
		return 'There was an error starting your activity.';
	}
	await ClientSettings.updateBankSetting('farming_cost_bank', totalCost);
	await user.statsBankUpdate('farming_plant_cost_bank', totalCost);

	const uniqueBoosts = [...new Set(plannedSteps.flatMap(step => step.boosts))];
	if (sharedLocationTiming.totalSavedDuration > 0) {
		uniqueBoosts.push(
			`Shared farming locations: saved ${formatDuration(sharedLocationTiming.totalSavedDuration)} travel time`
		);
	}
	const summaryLines: string[] = [];
	const infoDetails: string[] = [];

	plannedSteps.forEach((step, index) => {
		const { summaryLine, extraInfoLines } = buildSummaryForStep(index, step);
		summaryLines.push(summaryLine);
		infoDetails.push(...extraInfoLines);
	});

	const patchGroupCount = summaryLines.length;
	let response = `${user.minionName} is now auto farming ${patchGroupCount.toLocaleString()} patch group${
		patchGroupCount === 1 ? '' : 's'
	}, the trip will return in about ${formatTripDuration(
		user,
		totalDuration
	)}:\n\n**Patches:**\n${summaryLines.join('\n')}`;

	const itemsUsed = formatItemsUsed(totalCost);
	if (itemsUsed.length > 0) {
		response += `\n\n${itemsUsed}`;
	}

	if (infoDetails.length > 0) {
		response += `

${infoDetails.join('\n')}`;
	}

	response += formatFarmingBoosts(uniqueBoosts, { label: '**Boosts**:', suffix: '' });
	if (skippedDueToTripLength) {
		const skippedPatches = [...skippedPatchNamesDueToTripLength];
		const skippedPatchStr =
			skippedPatches.length > 0
				? `Skipped due to trip length: ${skippedPatches.join(', ')}.`
				: 'Some ready patches were skipped.';
		response += `\n\n${skippedPatchStr} Your maximum trip length is ${formatDuration(maxTripLength)}.`;
	}

	return response;
}
