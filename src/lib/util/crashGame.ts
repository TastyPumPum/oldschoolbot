const MULTIPLIER_PRECISION = 100;

const LOW_RISK_WEIGHTS = [600, 250, 110, 35, 5] as const;
const MED_RISK_WEIGHTS = [700, 180, 90, 25, 5] as const;
const HIGH_RISK_WEIGHTS = [780, 120, 70, 25, 5] as const;

const CRASH_TIERS = [
	{ min: 100, max: 130 },
	{ min: 131, max: 200 },
	{ min: 201, max: 500 },
	{ min: 501, max: 2000 },
	{ min: 2001, max: 10_000 }
] as const;

export const MIN_CRASH_MULTIPLIER = 101;
export const MAX_CRASH_MULTIPLIER = 10_000;

export type CrashRisk = 'low' | 'med' | 'high';

function getCrashTierWeights(risk: CrashRisk) {
	if (risk === 'low') return LOW_RISK_WEIGHTS;
	if (risk === 'high') return HIGH_RISK_WEIGHTS;
	return MED_RISK_WEIGHTS;
}

export function rollCrashPoint(rng: RNGProvider, risk: CrashRisk = 'med'): number {
	const weights = getCrashTierWeights(risk);
	const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
	let roll = rng.randInt(1, totalWeight);

	for (let i = 0; i < weights.length; i++) {
		roll -= weights[i];
		if (roll > 0) continue;
		const tier = CRASH_TIERS[i];
		return rng.randInt(tier.min, tier.max);
	}

	return MAX_CRASH_MULTIPLIER;
}

export function parseCrashAutoMultiplier(rawInput: string): number | null {
	const normalized = rawInput.trim().toLowerCase().replace(/x$/, '');
	if (!/^\d+(\.\d+)?$/.test(normalized)) {
		return null;
	}

	const parsed = Number(normalized);
	if (!Number.isFinite(parsed)) {
		return null;
	}

	return Math.floor(parsed * MULTIPLIER_PRECISION);
}

export function formatCrashMultiplier(multiplier: number): string {
	return `${(multiplier / MULTIPLIER_PRECISION).toFixed(2)}x`;
}
