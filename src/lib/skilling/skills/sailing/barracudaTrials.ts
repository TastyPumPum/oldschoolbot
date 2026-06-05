import { Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { SailingActivityId } from '@/lib/skilling/skills/sailing/activities.js';
import type { SailingFacilityId } from '@/lib/skilling/skills/sailing/facilities.js';
import type { Skills } from '@/lib/types/index.js';

export type BarracudaTrialId = Extract<SailingActivityId, 'tempor_tantrum' | 'jubbly_jive' | 'gwenith_glide'>;
export type BarracudaRank = 'swordfish' | 'shark' | 'marlin';

export interface BarracudaTrialRank {
	id: BarracudaRank;
	name: string;
	xp: number;
	bonusXP: number;
	targetTime: number;
	reward: Bank;
	objectives?: string[];
}

export interface BarracudaTrial {
	id: BarracudaTrialId;
	name: string;
	level: number;
	trialMaster: string;
	location: string;
	requiredFacility?: SailingFacilityId;
	requiredAnyFacilities?: SailingFacilityId[];
	mimickedQuestRequirement?: {
		name: string;
		qpReq?: number;
		skillReqs?: Partial<Skills>;
	};
	unsupportedRequirementNotes?: string[];
	paintChance: number;
	ranks: BarracudaTrialRank[];
}

export type BarracudaTrialsProgress = Partial<
	Record<
		BarracudaTrialId,
		{
			completedRanks?: BarracudaRank[];
			bestTimes?: Partial<Record<BarracudaRank, number>>;
		}
	>
>;

export const BarracudaRankOrder: BarracudaRank[] = ['swordfish', 'shark', 'marlin'];

export const BarracudaTrials: BarracudaTrial[] = [
	{
		id: 'tempor_tantrum',
		name: 'The Tempor Tantrum',
		level: 30,
		trialMaster: 'Rum-dashed Ralph',
		location: 'The Storm Tempor',
		unsupportedRequirementNotes: ['Requires a skiff with an iron helm and oak mast in OSRS.'],
		paintChance: 240,
		ranks: [
			{
				id: 'swordfish',
				name: 'Swordfish',
				xp: 595,
				bonusXP: 1000,
				targetTime: Time.Minute + Time.Second * 48,
				reward: new Bank().add('Stormy key')
			},
			{
				id: 'shark',
				name: 'Shark',
				xp: 1025,
				bonusXP: 2000,
				targetTime: Time.Minute * 2 + Time.Second * 51,
				reward: new Bank().add('Barrel stand').add('Whirlpool surprise')
			},
			{
				id: 'marlin',
				name: 'Marlin',
				xp: 1790,
				bonusXP: 3000,
				targetTime: Time.Minute * 4 + Time.Second * 30,
				reward: new Bank().add("Ralph's fabric roll")
			}
		]
	},
	{
		id: 'jubbly_jive',
		name: 'The Jubbly Jive',
		level: 55,
		trialMaster: 'Gurtob',
		location: 'Backwater',
		requiredFacility: 'inoculation_station',
		unsupportedRequirementNotes: ['Requires a skiff with at least a mithril helm in OSRS.'],
		paintChance: 220,
		ranks: [
			{
				id: 'swordfish',
				name: 'Swordfish',
				xp: 2392,
				bonusXP: 5000,
				targetTime: Time.Minute * 2 + Time.Second * 3,
				reward: new Bank().add('Fetid key'),
				objectives: ['Coerce 1 Jubbly bird to Gurtob', 'Collect 20 boxes']
			},
			{
				id: 'shark',
				name: 'Shark',
				xp: 4270,
				bonusXP: 7500,
				targetTime: Time.Minute * 3,
				reward: new Bank().add('Captured wind mote'),
				objectives: ['Coerce 2 Jubbly birds to Gurtob', 'Collect 38 boxes']
			},
			{
				id: 'marlin',
				name: 'Marlin',
				xp: 8204,
				bonusXP: 10_000,
				targetTime: Time.Minute * 5 + Time.Second * 21,
				reward: new Bank().add("Gurtob's fabric roll"),
				objectives: ['Coerce 3 Jubbly birds to Gurtob', 'Collect 56 boxes']
			}
		]
	},
	{
		id: 'gwenith_glide',
		name: 'The Gwenith Glide',
		level: 72,
		trialMaster: 'Gwyna',
		location: 'Porth Gwenith',
		mimickedQuestRequirement: {
			name: 'Regicide',
			qpReq: 50,
			skillReqs: {
				crafting: 10,
				agility: 56,
				ranged: 25
			}
		},
		requiredAnyFacilities: ['wind_catcher', 'gale_catcher'],
		unsupportedRequirementNotes: ['Requires a skiff with an adamant keel or better in OSRS.'],
		paintChance: 400,
		ranks: [
			{
				id: 'swordfish',
				name: 'Swordfish',
				xp: 4100,
				bonusXP: 25_000,
				targetTime: Time.Minute * 2,
				reward: new Bank().add('Serrated key'),
				objectives: [
					"Collect the rank's lost supplies",
					'Traverse portals to imbue the Crystals of Ithell',
					'Use crystal motes with a Wind catcher or Gale catcher to keep sails trimmed'
				]
			},
			{
				id: 'shark',
				name: 'Shark',
				xp: 9315,
				bonusXP: 35_000,
				targetTime: Time.Minute * 3 + Time.Second * 42,
				reward: new Bank().add('Heart of Ithell'),
				objectives: [
					"Collect the rank's lost supplies",
					'Traverse portals to imbue the Crystals of Ithell',
					'Use crystal motes with a Wind catcher or Gale catcher to keep sails trimmed'
				]
			},
			{
				id: 'marlin',
				name: 'Marlin',
				xp: 19_410,
				bonusXP: 50_000,
				targetTime: Time.Minute * 6 + Time.Second * 9,
				reward: new Bank().add("Gwyna's fabric roll"),
				objectives: [
					"Collect the rank's lost supplies",
					'Traverse portals to imbue the Crystals of Ithell',
					'Use crystal motes with a Wind catcher or Gale catcher to keep sails trimmed'
				]
			}
		]
	}
];

export const BarracudaTrialById = new Map(BarracudaTrials.map(trial => [trial.id, trial]));

export function isBarracudaTrialId(activityId: SailingActivityId): activityId is BarracudaTrialId {
	return BarracudaTrialById.has(activityId as BarracudaTrialId);
}

export function getBarracudaRank(trial: BarracudaTrial, rankId: string | undefined) {
	return trial.ranks.find(rank => rank.id === rankId);
}

export function formatBarracudaRankObjectives(rank: BarracudaTrialRank): string | null {
	return rank.objectives?.join('; ') ?? null;
}

export function getPreviousBarracudaRank(rank: BarracudaRank): BarracudaRank | null {
	const index = BarracudaRankOrder.indexOf(rank);
	return index <= 0 ? null : BarracudaRankOrder[index - 1];
}

export function getBarracudaTrialProgress(
	progress: BarracudaTrialsProgress,
	trialID: BarracudaTrialId
): { completedRanks: BarracudaRank[]; bestTimes: Partial<Record<BarracudaRank, number>> } {
	const trialProgress = progress[trialID];
	return {
		completedRanks: trialProgress?.completedRanks ?? [],
		bestTimes: trialProgress?.bestTimes ?? {}
	};
}

export function setBarracudaTrialProgress(
	progress: BarracudaTrialsProgress,
	trialID: BarracudaTrialId,
	completedRanks: BarracudaRank[],
	bestTimes: Partial<Record<BarracudaRank, number>>
): BarracudaTrialsProgress {
	return {
		...progress,
		[trialID]: {
			completedRanks,
			bestTimes
		}
	};
}
