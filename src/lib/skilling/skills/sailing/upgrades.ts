import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';

export const STARTER_SAIL_TRIM_DATA = { level: 1, xp: 10.5 } as const;

export function calculatePassiveSailingActions({
	duration,
	sailingLevel,
	facilities
}: {
	duration: number;
	sailingLevel: number;
	facilities: SailingFacilityId[];
}) {
	const trimData = STARTER_SAIL_TRIM_DATA;
	const trims = sailingLevel >= trimData.level ? Math.floor(duration / 30_000) : 0;
	const catcher = facilities.includes('gale_catcher')
		? 'gale_catcher'
		: facilities.includes('wind_catcher')
			? 'wind_catcher'
			: null;
	const trimXP = trims * trimData.xp * (catcher ? 0.75 : 1);
	const trimMoteXP = catcher ? trims * (catcher === 'gale_catcher' ? 70 : 40) : 0;
	const extractorHarvests = facilities.includes('crystal_extractor') ? Math.floor(duration / 63_000) : 0;
	const extractorXP = extractorHarvests * 250;
	const extractorMoteXP = catcher ? extractorHarvests * 10 : 0;

	return {
		trims,
		trimXP,
		trimMoteXP,
		extractorHarvests,
		extractorXP,
		extractorMoteXP,
		totalXP: trimXP + trimMoteXP + extractorXP + extractorMoteXP
	};
}
