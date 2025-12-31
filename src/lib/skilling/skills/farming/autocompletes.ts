import { Items } from 'oldschooljs';

import type { StringAutoComplete } from '@/discord/commands/commandOptions.js';
import TitheFarmBuyables from '@/lib/data/buyables/titheFarmBuyables.js';
import { superCompostables } from '@/lib/data/filterables.js';
import { getPlantsForPatch, getPrimarySeedForPlant } from './autoFarm/preferences.js';
import { Farming } from './index.js';

export async function farmingPlantNameAutoComplete({ value, user }: StringAutoComplete) {
	return Farming.Plants.filter(plant => user.skillsAsLevels.farming >= plant.level)
		.filter(plant => (!value ? true : plant.name.toLowerCase().includes(value.toLowerCase())))
		.map(plant => ({ name: plant.name, value: plant.name }));
}

export async function titheFarmBuyRewardAutoComplete({ value }: StringAutoComplete) {
	return TitheFarmBuyables.filter(buyable =>
		!value ? true : buyable.name.toLowerCase().includes(value.toLowerCase())
	).map(buyable => ({ name: buyable.name, value: buyable.name }));
}

export async function compostBinPlantNameAutoComplete({ value }: StringAutoComplete) {
	return superCompostables
		.filter(plantName => (!value ? true : plantName.toLowerCase().includes(value.toLowerCase())))
		.map(plantName => ({ name: plantName, value: plantName }));
}

export async function farmingSeedPreferenceAutoComplete({ value, user }: StringAutoComplete) {
	const normalized = value?.toLowerCase() ?? '';
	const seen = new Set<string>();
	const suggestions: { name: string; value: string }[] = [];

	const addSuggestion = (name: string) => {
		const key = name.toLowerCase();
		if ((normalized && !key.includes(normalized)) || seen.has(key)) {
			return;
		}
		seen.add(key);
		suggestions.push({ name, value: name });
	};

	addSuggestion('highest_available');
	addSuggestion('empty');

	const { patchesDetailed } = Farming.getFarmingInfoFromUser(user);
	for (const patch of patchesDetailed) {
		for (const plant of getPlantsForPatch(patch.patchName)) {
			addSuggestion(plant.name);
			const seedID = getPrimarySeedForPlant(plant);
			if (!seedID) continue;
			const seedItem = Items.get(seedID);
			if (seedItem) {
				addSuggestion(seedItem.name);
			}
		}
	}

	return suggestions.slice(0, 25);
}
