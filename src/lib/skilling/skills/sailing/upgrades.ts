import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';
import type { SailingMastSailsTier } from '@/lib/skilling/skills/sailing/shipParts.js';

export const STARTER_SAIL_TRIM_DATA = { level: 1, xp: 10.5 } as const;

// https://oldschool.runescape.wiki/w/Mast_and_sails
export const sailTrimXP: Record<SailingMastSailsTier, number> = {
	wooden_linen: 10.5,
	oak_linen: 19.5,
	teak_canvas: 30,
	mahogany_canvas: 48,
	camphor_canvas: 64,
	ironwood_cotton: 80,
	rosewood_cotton: 125
};

export function calculatePassiveSailingActions({
	duration,
	sailingLevel,
	facilities,
	sails = 'wooden_linen'
}: {
	duration: number;
	sailingLevel: number;
	facilities: SailingFacilityId[];
	sails?: SailingMastSailsTier;
}) {
	const trims = sailingLevel >= STARTER_SAIL_TRIM_DATA.level ? Math.floor(duration / 30_000) : 0;
	const catcher = facilities.includes('gale_catcher')
		? 'gale_catcher'
		: facilities.includes('wind_catcher')
			? 'wind_catcher'
			: null;
	const trimXP = trims * sailTrimXP[sails] * (catcher ? 0.75 : 1);
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
