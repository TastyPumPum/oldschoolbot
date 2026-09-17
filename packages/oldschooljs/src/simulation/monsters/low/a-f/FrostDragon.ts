import { GemTable, RareDropTable } from '@/simulation/subtables/RareDropTable.js';
import LootTable from '@/structures/LootTable.js';
import { SimpleMonster } from '@/structures/Monster.js';

const FrostDragonCommonTable: LootTable = new LootTable({ limit: 130 })
	/* Weapons and armour */
	.add('Rune 2h sword', 1, 2)
	.add('Rune kiteshield', 1, 2)
	.add('Rune longsword', 1, 2)
	.add('Rune pickaxe', 1, 2)
	.add('Adamant platebody', 1, 4)
	.add('Adamant warhammer', 1, 4)

	/* Runes and ammunition */
	.add('Death rune', [20, 30], 5)
	.add('Water rune', [100, 200], 10)
	.add('Water rune', 500, 5)
	.add('Air rune', [100, 200], 11)
	.add('Blood rune', [10, 20], 5)
	.add('Chaos rune', [60, 80], 8)
	.add('Mist rune', [40, 60], 10)
	.add('Nature rune', [10, 20], 4)
	.add('Dragon cannonball', [12, 20], 2)
	.add('Rune cannonball', [20, 35], 4)
	.add('Rune knife', [10, 20], 5)

	/* Other */
	.add('Dragon arrowtips', [5, 10], 4)
	.add('Superior dragon bones', 1, 3)
	.add('Runite ore', 1, 3)
	.add('Adamantite ore', 1, 3)
	.add('Dragon nails', [10, 20], 2)
	.add('Coins', [50, 100], 10)
	.add('Coins', [200, 500], 10)
	.add('Apple pie', 1, 5)

	/* RDT */
	.add(RareDropTable, 1, 2)
	.add(GemTable, 1, 3);

const FrostDragonPreRollTable: LootTable = new LootTable().oneIn(100, 'Dragon metal sheet');

const FrostDragonOnTaskPreRollTable: LootTable = new LootTable().oneIn(40, 'Dragon metal sheet');

const FrostDragonTable: LootTable = new LootTable()
	.every('Frost dragon bones')
	.every(FrostDragonPreRollTable)
	.every(FrostDragonCommonTable)

	/* Tertiary */
	.tertiary(128, 'Clue scroll (hard)')
	.tertiary(10_000, 'Draconic visage');

const FrostDragonOnTaskTable: LootTable = new LootTable()
	.every('Frost dragon bones')
	.every(FrostDragonOnTaskPreRollTable)
	.every(FrostDragonCommonTable)

	/* Tertiary */
	.tertiary(128, 'Clue scroll (hard)')
	.tertiary(10_000, 'Draconic visage');

export const FrostDragon: SimpleMonster = new SimpleMonster({
	id: 14_922,
	name: 'Frost Dragon',
	table: FrostDragonTable,
	onTaskTable: FrostDragonOnTaskTable,
	aliases: ['frost dragon', 'frost dragons', 'frost drags']
});
