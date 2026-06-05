import { Time } from '@oldschoolgg/toolkit';

export type SalvagingShipwreckId =
	| 'small'
	| 'fishermans'
	| 'barracuda'
	| 'large'
	| 'pirate'
	| 'mercenary'
	| 'fremennik'
	| 'merchant';

export type StoredSalvage = Partial<Record<SalvagingShipwreckId, number>>;

export interface SalvagingShipwreck {
	id: SalvagingShipwreckId;
	name: string;
	salvageName: string;
	level: number;
	salvagingXP: number;
	sortingXP: number;
	averageDuration: number;
}

export const SalvagingShipwrecks: SalvagingShipwreck[] = [
	{
		id: 'small',
		name: 'Small shipwreck',
		salvageName: 'Small salvage',
		level: 15,
		salvagingXP: 10,
		sortingXP: 5.5,
		averageDuration: Time.Minute
	},
	{
		id: 'fishermans',
		name: "Fisherman's shipwreck",
		salvageName: 'Fishy salvage',
		level: 26,
		salvagingXP: 17,
		sortingXP: 9,
		averageDuration: Time.Minute * 3
	},
	{
		id: 'barracuda',
		name: 'Barracuda shipwreck',
		salvageName: 'Barracuda salvage',
		level: 35,
		salvagingXP: 31,
		sortingXP: 15.5,
		averageDuration: Time.Minute * 3
	},
	{
		id: 'large',
		name: 'Large shipwreck',
		salvageName: 'Large salvage',
		level: 53,
		salvagingXP: 48,
		sortingXP: 24,
		averageDuration: Time.Minute * 3
	},
	{
		id: 'pirate',
		name: 'Pirate shipwreck',
		salvageName: 'Plundered salvage',
		level: 64,
		salvagingXP: 76,
		sortingXP: 31.5,
		averageDuration: Time.Minute * 3
	},
	{
		id: 'mercenary',
		name: 'Mercenary shipwreck',
		salvageName: 'Martial salvage',
		level: 73,
		salvagingXP: 138,
		sortingXP: 63.5,
		averageDuration: Time.Minute * 3.25
	},
	{
		id: 'fremennik',
		name: 'Fremennik shipwreck',
		salvageName: 'Fremennik salvage',
		level: 80,
		salvagingXP: 162,
		sortingXP: 75,
		averageDuration: Time.Minute * 3 + Time.Second * 40
	},
	{
		id: 'merchant',
		name: 'Merchant shipwreck',
		salvageName: 'Opulent salvage',
		level: 87,
		salvagingXP: 200,
		sortingXP: 95,
		averageDuration: Time.Minute * 4
	}
];

export const SalvagingShipwreckById = new Map(SalvagingShipwrecks.map(shipwreck => [shipwreck.id, shipwreck]));

export function getBestSalvagingShipwreckForLevel(level: number) {
	return [...SalvagingShipwrecks].reverse().find(shipwreck => level >= shipwreck.level);
}

export function addStoredSalvage(
	stored: StoredSalvage,
	shipwreck: SalvagingShipwreckId,
	quantity: number
): StoredSalvage {
	return {
		...stored,
		[shipwreck]: (stored[shipwreck] ?? 0) + quantity
	};
}

export function removeStoredSalvage(
	stored: StoredSalvage,
	shipwreck: SalvagingShipwreckId,
	quantity: number
): StoredSalvage {
	const next = { ...stored };
	const remaining = (next[shipwreck] ?? 0) - quantity;
	if (remaining > 0) {
		next[shipwreck] = remaining;
	} else {
		delete next[shipwreck];
	}
	return next;
}

export function formatStoredSalvage(stored: StoredSalvage): string {
	const entries = SalvagingShipwrecks.filter(shipwreck => (stored[shipwreck.id] ?? 0) > 0).map(
		shipwreck => `${stored[shipwreck.id]!.toLocaleString()}x ${shipwreck.salvageName}`
	);
	return entries.length === 0 ? 'None' : entries.join(', ');
}
