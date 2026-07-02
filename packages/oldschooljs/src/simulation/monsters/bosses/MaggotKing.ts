import LootTable from '@/structures/LootTable.js';
import { SimpleMonster } from '@/structures/Monster.js';

const MaggotKingSupplyTable: LootTable = new LootTable().every('Stymphike tartare', [2, 4]).every('Dull ancient medal');

const MaggotKingTable: LootTable = new LootTable()
	.tertiary(334, 'Elder venator fang')
	.tertiary(500, 'Crimson kisten')
	.tertiary(3333, 'Maggot marquess')

	.add(MaggotKingSupplyTable, 1, 41)

	.add('Uncut ruby', [6, 9], 15)
	.add('Stymphike feather', [11, 34], 10)
	.add('Mort myre fungus', [50, 76], 10)
	.add('Leechfin', [7, 15], 10)
	.add('Letvek', [23, 34], 10)
	.add('Runite ore', [8, 15], 5)
	.add('Blood sac', [2, 5], 5)
	.add('Gold ore', [14, 22], 5)
	.add('Mithril ore', [16, 21], 5)
	.add('Orikalkum gravel', [3, 5], 4)
	.add('Venator fang', [112, 179], 2)
	.add('Venator tooth', [178, 219], 2)

	.add('Tarnished spear', 1, 12)
	.add('Tarnished ring', 1, 6)
	///.add('Tarnished necklace (bracelet)', 1, 3)///
	.add('Tarnished necklace', 1, 3)
	.add('Tarnished amulet', 1, 3)
	.add('Tarnished battleaxe', 1, 2)
	.add('Tarnished longsword', 1, 2)
	.add('Tarnished halberd', 1, 2)
	.add('Tarnished 2h sword', 1, 2);

export const MaggotKing: SimpleMonster = new SimpleMonster({
	id: 15_742,
	name: 'Maggot King',
	table: MaggotKingTable,
	aliases: ['maggot king', 'maggotking', 'mag king']
});
