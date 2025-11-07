import { plants } from '@/lib/skilling/skills/farming/index.js';
import type { FarmingPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import { isPatchName } from '@/lib/skilling/skills/farming/utils/farmingHelpers.js';
import type { FarmingPreferredSeeds, FarmingSeedPreference } from '@/lib/skilling/skills/farming/utils/types.js';
import type { Plant } from '@/lib/skilling/types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const plantsByPatch = new Map<FarmingPatchName, Plant[]>();
for (const plant of plants) {
	const list = plantsByPatch.get(plant.seedType) ?? [];
	list.push(plant);
	plantsByPatch.set(plant.seedType, list);
}
for (const list of plantsByPatch.values()) {
	list.sort((a, b) => b.level - a.level);
}

export function getPlantsForPatch(patchName: FarmingPatchName): Plant[] {
	return plantsByPatch.get(patchName) ?? [];
}

export function findPlantBySeedID(seedID: number, patchName: FarmingPatchName): Plant | null {
	for (const plant of getPlantsForPatch(patchName)) {
		if (plant.inputItems.amount(seedID) > 0) {
			return plant;
		}
	}
	return null;
}

export function getPrimarySeedForPlant(plant: Plant): number | null {
	for (const [item] of plant.inputItems.items()) {
		return item.id;
	}
	return null;
}

export function parsePreferredSeeds(raw: unknown): Map<FarmingPatchName, FarmingSeedPreference> {
	const result = new Map<FarmingPatchName, FarmingSeedPreference>();
	if (!isRecord(raw)) {
		return result;
	}

	for (const [key, value] of Object.entries(raw)) {
		if (!isPatchName(key) || !isRecord(value) || typeof value.type !== 'string') {
			continue;
		}
		if (value.type === 'seed' && typeof value.seedID === 'number') {
			result.set(key, { type: 'seed', seedID: value.seedID });
		} else if (value.type === 'highest_available') {
			result.set(key, { type: 'highest_available' });
		} else if (value.type === 'empty') {
			result.set(key, { type: 'empty' });
		}
	}

	return result;
}

export function serializePreferredSeeds(
	preferences: Map<FarmingPatchName, FarmingSeedPreference>
): FarmingPreferredSeeds {
	return Object.fromEntries(preferences.entries());
}
