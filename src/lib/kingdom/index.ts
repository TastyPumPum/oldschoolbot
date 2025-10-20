import { cofferReductionPerDay, type KingdomInputs, type SimulatorResult, simulateEV } from 'oldschooljs';

import { fromPct, type KingdomProjectionInput } from './types.js';

export function projectDaily(input: KingdomProjectionInput): SimulatorResult {
	const kingdomInputs: KingdomInputs = {
		days: input.days,
		workers: input.workers,
		category: input.category,
		startingApproval: fromPct(input.startingApprovalPct),
		royalTrouble: input.royalTrouble,
		constantApproval: input.constantApproval,
		startingCoffer: input.startingCoffer
	};

	return simulateEV(kingdomInputs);
}

export function estimateDaysUntilCofferEmpty(startingCoffer: number, royalTrouble: boolean): number | null {
	let coffer = Math.max(0, Math.floor(startingCoffer));
	if (coffer === 0) {
		return 0;
	}
	const maxIterations = 10_000;
	for (let days = 1; days <= maxIterations; days++) {
		const reduction = cofferReductionPerDay(coffer, royalTrouble);
		if (reduction <= 0) {
			return null;
		}
		coffer -= reduction;
		if (coffer <= 0) {
			return days;
		}
	}
	return null;
}
