import { Time } from '@oldschoolgg/toolkit';
import { GemTable, LootTable, RareSeedTable } from 'oldschooljs';

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
	salvagePerAction: number;
	petChance: number;
	lootTable: LootTable;
}

const SmallSalvageTable = new LootTable({ limit: 1721 })
	.add('Bronze bar', 1, 200)
	.add('Bronze nails', [1, 5], 200)
	.add('Logs', 1, 200)
	.add('Iron nails', [1, 5], 100)
	.add('Plank', 1, 100)
	.add('Oak logs', 1, 100)
	.add('Sawmill coupon (wood plank)', 1, 100)
	.add('Iron bar', 1, 50)
	.add('Oak plank', 1, 50)
	.add('Sawmill coupon (oak plank)', 1, 50)
	.add('Steel bar', 1, 1)
	.add('Air rune', [1, 10], 100)
	.add('Water rune', [1, 10], 100)
	.add('Bronze cannonball', [2, 7], 100)
	.add('Iron cannonball', [2, 7], 50)
	.add('Steel arrow', [1, 5], 20)
	.add('Coins', [1, 200], 100)
	.add('Bones', 1, 100)
	.tertiary(3000, 'Rusty locket')
	.tertiary(300, 'Clue scroll (beginner)')
	.tertiary(800_000, 'Soup');

const FishySalvageTable = new LootTable({ limit: 467 })
	.add('Oak logs', 1, 40)
	.add('Oak plank', 1, 20)
	.add('Sawmill coupon (oak plank)', 1, 20)
	.add('Logs', 1, 20)
	.add('Iron bar', 1, 20)
	.add('Iron nails', [1, 5], 20)
	.add('Steel nails', [1, 5], 10)
	.add('Plank', 1, 10)
	.add('Steel bar', 1, 1)
	.add('Feather', [15, 200], 40)
	.add('Fishing bait', [20, 100], 40)
	.add('Raw lobster', 1, 40)
	.add('Raw mackerel', 1, 40)
	.add('Raw swordfish', 1, 40)
	.add('Fishing rod', 1, 2)
	.add('Harpoon', 1, 2)
	.add('Lobster pot', 1, 2)
	.add('Seaweed', 1, 40)
	.add('Bronze cannonball', [2, 7], 40)
	.add('Iron cannonball', [1, 5], 20)
	.tertiary(3000, 'Mouldy block')
	.tertiary(300, 'Clue scroll (easy)')
	.tertiary(800_000, 'Soup');

const BarracudaSalvageTable = new LootTable({ limit: 28_401 })
	.add('Flax seed', [1, 3], 500)
	.add('Hemp seed', [1, 3], 125)
	.add('Swamp paste', [1, 10], 5000)
	.add('Oak logs', 1, 5000)
	.add('Teak logs', 1, 3750)
	.add('Steel nails', [1, 5], 2500)
	.add('Teak repair kit', 1, 2500)
	.add('Rope', 1, 1250)
	.add('Oak plank', 1, 1250)
	.add('Copper ore', 1, 500)
	.add('Teak plank', 1, 250)
	.add('Lead ore', 1, 25)
	.add('Raw swordfish', 1, 500)
	.add('Raw shark', 1, 250)
	.add('Raw marlin', 1, 1)
	.add('Rum', 1, 2500)
	.add('Banana', 1, 1250)
	.tertiary(3000, 'Dull knife')
	.tertiary(300, 'Clue scroll (medium)')
	.tertiary(800_000, 'Soup');

const LargeSalvageTable = new LootTable({ limit: 2218 })
	.add('Steel nails', [1, 5], 200)
	.add('Teak logs', 1, 200)
	.add('Oak plank', 1, 50)
	.add('Mithril nails', [1, 5], 30)
	.add('Elkhorn frag', [1, 5], 10)
	.add('Hemp seed', [1, 5], 10)
	.add('Cotton seed', [1, 5], 5)
	.add('Pillar frag', [1, 5], 2)
	.add('Camphor seed', 1, 1)
	.add('Gold ring', 1, 300)
	.add('Sapphire ring', 1, 300)
	.add('Emerald ring', 1, 300)
	.add('Diamond ring', 1, 200)
	.add('Oyster pearl', 1, 200)
	.add('Oyster pearls', 1, 200)
	.add('Casket', 1, 100)
	.add('Giant seaweed', 1, 50)
	.add('Mithril cannonball', [2, 5], 50)
	.add('Adamant cannonball', [1, 7], 10)
	.tertiary(3000, 'Broken compass')
	.tertiary(800_000, 'Soup');

const PlunderedSalvageTable = new LootTable({ limit: 1036 })
	.add('Rum', 1, 100)
	.add('Mithril cannonball', [2, 5], 50)
	.add('Adamant cannonball', [2, 5], 25)
	.add('Mahogany repair kit', 1, 25)
	.add('Rune cannonball', [2, 4], 10)
	.add('Mithril scimitar', 1, 100)
	.add('Rune scimitar', 1, 1)
	.add('Oyster pearls', 1, 100)
	.add('Gold ring', 1, 200)
	.add('Sapphire ring', 1, 100)
	.add('Emerald bracelet', 1, 100)
	.add('Ruby bracelet', 1, 75)
	.add('Emerald ring', 1, 50)
	.add('Casket', 1, 50)
	.add('Diamond bracelet', 1, 25)
	.add('Diamond ring', 1, 25)
	.tertiary(3000, 'Rusty coin')
	.tertiary(3000, 'Dragon cannonball', [2, 3])
	.tertiary(800_000, 'Soup');

const MartialSalvageTable = new LootTable({ limit: 2440 })
	.add('Mithril longsword', 1, 300)
	.add('Adamant longsword', 1, 200)
	.add('Adamant 2h sword', 1, 100)
	.add("Green d'hide body", 1, 100)
	.add('Rune longsword', 1, 10)
	.add('Adamant arrowtips', [1, 5], 300)
	.add('Mithril dart tip', [1, 5], 300)
	.add('Adamant dart tip', [1, 3], 200)
	.add('Adamant arrow', [1, 3], 200)
	.add('Adamant bolts(unf)', [1, 3], 100)
	.add('Rune arrow', [1, 3], 100)
	.add('Adamant cannonball', [2, 5], 100)
	.add('Rune cannonball', [2, 4], 50)
	.add('Umbral frag', 1, 10)
	.add('Camphor seed', 1, 10)
	.add('Ironwood seed', 1, 1)
	.add('Mahogany logs', 1, 100)
	.add('Camphor logs', 1, 6)
	.add('Ironwood logs', 1, 3)
	.add('Amulet of power', 1, 200)
	.add('Adamantite nails', [1, 3], 50)
	.tertiary(3000, 'Broken sextant')
	.tertiary(3000, 'Dragon cannonball', [2, 3])
	.tertiary(24_000, "Salvor's paint")
	.tertiary(500, 'Clue scroll (hard)')
	.tertiary(800_000, 'Soup');

const FremennikSalvageTable = new LootTable({ limit: 2670 })
	.add('Raw salmon', 1, 400)
	.add('Raw tuna', 1, 400)
	.add('Raw lobster', 1, 400)
	.add('Raw monkfish', 1, 400)
	.add('Archer helm', 1, 8)
	.add('Berserker helm', 1, 8)
	.add('Farseer helm', 1, 8)
	.add('Warrior helm', 1, 8)
	.add('Fremennik helm', 1, 8)
	.add('Mithril ore', 1, 300)
	.add('Arctic pine logs', 1, 200)
	.add('Adamantite nails', [1, 3], 100)
	.add('Rune nails', [1, 3], 50)
	.add('Mahogany plank', 1, 50)
	.add('Ironwood logs', 1, 6)
	.add('Rosewood logs', 1, 3)
	.add('Cotton seed', [1, 3], 10)
	.add('Umbral frag', 1, 5)
	.add('Ironwood seed', 1, 5)
	.add('Rosewood seed', 1, 1)
	.add('Astral rune', [1, 3], 200)
	.add('Ensouled troll head', 1, 50)
	.add('Rune cannonball', [2, 5], 50)
	.tertiary(3000, 'Smashed mirror')
	.tertiary(800_000, 'Soup');

const UsefulHerbTable = new LootTable()
	.add('Grimy avantoe', 1, 10)
	.add('Grimy ranarr weed', 1, 8)
	.add('Grimy snapdragon', 1, 8)
	.add('Grimy torstol', 1, 6);

const CombatHerbTable = new LootTable()
	.add('Grimy kwuarm', 1, 5)
	.add('Grimy dwarf weed', 1, 4)
	.add('Grimy cadantine', 1, 4)
	.add('Grimy lantadyme', 1, 3);

const SalvageGemTable = GemTable.clone().add('Coins', 1, 63);

const OpulentSalvageTable = new LootTable({ limit: 424 })
	.add('Rune cannonball', [2, 5], 3)
	.add('Fish offcuts', [1, 10], 30)
	.add('Ironwood repair kit', 1, 10)
	.add('Dragon cannonball', [2, 5], 1)
	.add(RareSeedTable, 1, 10)
	.add(UsefulHerbTable, 1, 10)
	.add(CombatHerbTable, 1, 10)
	.add('Uncut opal', 1, 30)
	.add('Uncut jade', 1, 30)
	.add('Uncut red topaz', 1, 30)
	.add('Silver ore', 1, 30)
	.add('Silver bar', 1, 30)
	.add('Tiara', 1, 30)
	.add('Jug of wine', 1, 30)
	.add('Spice', 1, 30)
	.add('Grey wolf fur', 1, 30)
	.add('Silk', 1, 30)
	.add('Coins', [1000, 5000], 20)
	.add('Platinum token', [1, 5], 20)
	.add(SalvageGemTable, 1, 10)
	.tertiary(2000, 'Dragon nails', [1, 3])
	.tertiary(3000, 'Mouldy doll')
	.tertiary(20_000, 'Dragon cannon barrel')
	.tertiary(800_000, 'Soup');

export const SalvagingShipwrecks: SalvagingShipwreck[] = [
	{
		id: 'small',
		name: 'Small shipwreck',
		salvageName: 'Small salvage',
		level: 15,
		salvagingXP: 10,
		sortingXP: 5.5,
		averageDuration: Time.Minute,
		salvagePerAction: 12,
		petChance: 800_000,
		lootTable: SmallSalvageTable
	},
	{
		id: 'fishermans',
		name: "Fisherman's shipwreck",
		salvageName: 'Fishy salvage',
		level: 26,
		salvagingXP: 17,
		sortingXP: 9,
		averageDuration: Time.Minute * 3,
		salvagePerAction: 12,
		petChance: 500_000,
		lootTable: FishySalvageTable
	},
	{
		id: 'barracuda',
		name: 'Barracuda shipwreck',
		salvageName: 'Barracuda salvage',
		level: 35,
		salvagingXP: 31,
		sortingXP: 15.5,
		averageDuration: Time.Minute * 3,
		salvagePerAction: 12,
		petChance: 300_000,
		lootTable: BarracudaSalvageTable
	},
	{
		id: 'large',
		name: 'Large shipwreck',
		salvageName: 'Large salvage',
		level: 53,
		salvagingXP: 48,
		sortingXP: 24,
		averageDuration: Time.Minute * 3,
		salvagePerAction: 12,
		petChance: 280_000,
		lootTable: LargeSalvageTable
	},
	{
		id: 'pirate',
		name: 'Pirate shipwreck',
		salvageName: 'Plundered salvage',
		level: 64,
		salvagingXP: 76,
		sortingXP: 31.5,
		averageDuration: Time.Minute * 3,
		salvagePerAction: 12,
		petChance: 275_000,
		lootTable: PlunderedSalvageTable
	},
	{
		id: 'mercenary',
		name: 'Mercenary shipwreck',
		salvageName: 'Martial salvage',
		level: 73,
		salvagingXP: 138,
		sortingXP: 63.5,
		averageDuration: Time.Minute * 3.25,
		salvagePerAction: 12,
		petChance: 260_000,
		lootTable: MartialSalvageTable
	},
	{
		id: 'fremennik',
		name: 'Fremennik shipwreck',
		salvageName: 'Fremennik salvage',
		level: 80,
		salvagingXP: 162,
		sortingXP: 75,
		averageDuration: Time.Minute * 3 + Time.Second * 40,
		salvagePerAction: 12,
		petChance: 230_000,
		lootTable: FremennikSalvageTable
	},
	{
		id: 'merchant',
		name: 'Merchant shipwreck',
		salvageName: 'Opulent salvage',
		level: 87,
		salvagingXP: 200,
		sortingXP: 95,
		averageDuration: Time.Minute * 4,
		salvagePerAction: 12,
		petChance: 160_000,
		lootTable: OpulentSalvageTable
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
