import { Time } from '@oldschoolgg/toolkit';

import { BarracudaTrials } from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';
import { type SalvagingShipwreckId, SalvagingShipwrecks } from '@/lib/skilling/skills/sailing/salvaging.js';
import { type TrawlingShoalId, TrawlingShoals } from '@/lib/skilling/skills/sailing/trawling.js';

export type SailingActivityId =
	| 'sea_charting'
	| 'port_tasks'
	| 'shipwreck_salvaging'
	| 'tempor_tantrum'
	| 'jubbly_jive'
	| 'gwenith_glide'
	| 'deep_sea_trawling';

export interface SailingActivity {
	id: SailingActivityId;
	name: string;
	level: number;
	baseTime: number;
	variants?: Array<{
		id: 'courier' | 'bounty' | 'swordfish' | 'shark' | 'marlin' | SalvagingShipwreckId | TrawlingShoalId;
		name: string;
		timeMultiplier?: number;
	}>;
	requiredItems?: string[];
	requiredFacility?: SailingFacilityId;
	requiredAnyFacilities?: SailingFacilityId[];
	requiredReputation?: number;
	qpRequired?: number;
}

export const SailingActivities: SailingActivity[] = [
	{
		id: 'sea_charting',
		name: 'Sea charting',
		level: 1,
		baseTime: Time.Minute * 1.5
	},
	{
		id: 'port_tasks',
		name: 'Port tasks',
		level: 1,
		baseTime: Time.Minute * 10,
		variants: [
			{ id: 'courier', name: 'Courier tasks' },
			{ id: 'bounty', name: 'Bounty tasks' }
		]
	},
	{
		id: 'shipwreck_salvaging',
		name: 'Shipwreck salvaging',
		level: 15,
		baseTime: Time.Minute,
		requiredFacility: 'salvaging_hook',
		variants: SalvagingShipwrecks.map(shipwreck => ({
			id: shipwreck.id,
			name: shipwreck.name,
			timeMultiplier: shipwreck.averageDuration / Time.Minute
		}))
	},
	...BarracudaTrials.map(trial => ({
		id: trial.id,
		name: trial.name,
		level: trial.level,
		baseTime: trial.ranks[0].targetTime,
		requiredFacility: trial.requiredFacility,
		requiredAnyFacilities: trial.requiredAnyFacilities,
		variants: trial.ranks.map(rank => ({
			id: rank.id,
			name: rank.name,
			timeMultiplier: rank.targetTime / trial.ranks[0].targetTime
		}))
	})),
	{
		id: 'deep_sea_trawling',
		name: 'Deep sea trawling',
		level: 56,
		baseTime: Time.Second * 1.8,
		requiredAnyFacilities: ['rope_trawling_net', 'linen_trawling_net', 'hemp_trawling_net', 'cotton_trawling_net'],
		variants: TrawlingShoals.map(shoal => ({
			id: shoal.id,
			name: shoal.name
		}))
	}
];

export const SailingActivityById = new Map(SailingActivities.map(activity => [activity.id, activity]));

export function getMaxPortTasks(sailingLevel: number) {
	if (sailingLevel >= 84) return 5;
	if (sailingLevel >= 56) return 4;
	if (sailingLevel >= 28) return 3;
	if (sailingLevel >= 7) return 2;
	return 1;
}

export function getPortTaskXPHour(variant: 'courier' | 'bounty', sailingLevel: number) {
	if (variant === 'bounty') {
		if (sailingLevel >= 80) return 150_000;
		if (sailingLevel >= 65) return 130_000;
		if (sailingLevel >= 55) return 90_000;
		if (sailingLevel >= 40) return 60_000;
		return 35_000;
	}
	if (sailingLevel >= 84) return 135_000;
	if (sailingLevel >= 76) return 120_000;
	if (sailingLevel >= 62) return 60_000;
	if (sailingLevel >= 56) return 45_000;
	if (sailingLevel >= 46) return 30_000;
	if (sailingLevel >= 30) return 15_000;
	return 8_000;
}
