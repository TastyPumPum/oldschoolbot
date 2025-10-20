import type { KingdomInputs } from 'oldschooljs';

export type KingdomCategory = KingdomInputs['category'];

export interface KingdomProjectionInput {
	days: number;
	workers: number;
	category: KingdomCategory;
	startingApprovalPct: number;
	royalTrouble: boolean;
	constantApproval: boolean;
	startingCoffer: number;
}

export interface KingdomCategoryDefinition {
	key: KingdomCategory;
	label: string;
}

export const KINGDOM_CATEGORY_DEFINITIONS: readonly KingdomCategoryDefinition[] = [
	{ key: 'maple', label: 'Wood (Maple)' },
	{ key: 'coal', label: 'Mining (Coal)' },
	{ key: 'fish_raw', label: 'Fishing (Raw)' },
	{ key: 'fish_cooked', label: 'Fishing (Cooked)' },
	{ key: 'herbs', label: 'Herbs' },
	{ key: 'flax', label: 'Flax' },
	{ key: 'mahogany', label: 'Hardwood (Mahogany)' },
	{ key: 'teak', label: 'Hardwood (Teak)' },
	{ key: 'hardwood_both', label: 'Hardwood (Both)' },
	{ key: 'farm_seeds', label: 'Farm (Seeds)' }
] as const;

const MAX_APPROVAL = 127;

export function toPct(approval: number): number {
	const clamped = clamp(approval, 0, MAX_APPROVAL);
	return Math.round((clamped / MAX_APPROVAL) * 100);
}

export function fromPct(pct: number): number {
	const clamped = clamp(pct, 0, 100);
	return Math.round((clamped / 100) * MAX_APPROVAL);
}

export function getCategoryLabel(category: KingdomCategory): string {
	return KINGDOM_CATEGORY_DEFINITIONS.find(definition => definition.key === category)?.label ?? category;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
