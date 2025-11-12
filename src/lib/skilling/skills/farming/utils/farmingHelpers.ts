import { type ButtonBuilder, dateFm } from '@oldschoolgg/discord';
import { Emoji, stringMatches } from '@oldschoolgg/toolkit';

import { Farming } from '@/lib/skilling/skills/farming/index.js';
import { getFarmingInfoFromUser } from '@/lib/skilling/skills/farming/utils/getFarmingInfo.js';
import type { IPatchData, IPatchDataDetailed } from '@/lib/skilling/skills/farming/utils/types.js';
import { makeAutoFarmButton } from '@/lib/util/interactions.js';
import { formatList } from '@/lib/util/smallUtils.js';

export const farmingPatchNames = [
	'herb',
	'fruit_tree',
	'tree',
	'allotment',
	'hops',
	'cactus',
	'bush',
	'spirit',
	'hardwood',
	'seaweed',
	'vine',
	'calquat',
	'redwood',
	'crystal',
	'celastrus',
	'hespori',
	'flower',
	'mushroom',
	'belladonna'
] as const;

export type FarmingPatchName = (typeof farmingPatchNames)[number];

export function isPatchName(name: string): name is FarmingPatchName {
	return farmingPatchNames.includes(name as FarmingPatchName);
}

export type FarmingPatchSettingsKey = `farmingPatches_${FarmingPatchName}`;

export function getFarmingKeyFromName(name: FarmingPatchName): FarmingPatchSettingsKey {
	return `farmingPatches_${name}`;
}

export function findPlant(lastPlanted: IPatchData['lastPlanted']) {
	if (!lastPlanted) return null;
	const plant = Farming.Plants.find(
		plants => stringMatches(plants.name, lastPlanted) || plants.aliases.some(a => stringMatches(a, lastPlanted))
	);
	if (!plant) return null;
	return plant;
}

export function hasAnyReadyPatch(patches: IPatchDataDetailed[]): boolean {
	return patches.some(p => p.ready === true);
}

export async function canShowAutoFarmButton(user: MUser): Promise<boolean> {
	const info = await getFarmingInfoFromUser(user);
	return hasAnyReadyPatch(info.patchesDetailed);
}

export function userGrowingProgressStr(patchesDetailed: IPatchDataDetailed[]): SendableMessage {
	let str = '';
	for (const patch of patchesDetailed.filter(i => i.ready === true)) {
		str += `${Emoji.Tick} **${patch.friendlyName}**: ${patch.lastQuantity} ${patch.lastPlanted} are ready to be harvested!\n`;
	}
	for (const patch of patchesDetailed.filter(i => i.ready === false)) {
		str += `${Emoji.Stopwatch} **${patch.friendlyName}**: ${patch.lastQuantity} ${patch.lastPlanted} ready at ${dateFm(patch.readyAt!)}\n`;
	}
	const notReady = patchesDetailed.filter(i => i.ready === null);
	str += `${Emoji.RedX} **Nothing planted:** ${formatList(notReady.map(i => i.friendlyName))}.`;

	const buttons: ButtonBuilder[] = [];
	if (hasAnyReadyPatch(patchesDetailed)) {
		buttons.push(makeAutoFarmButton());
	}

	return { content: str, components: buttons };
}
