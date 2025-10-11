import type { DisassemblySourceGroup } from '@/lib/bso/skills/invention/index.js';

import { Items } from 'oldschooljs';

const i = Items.getOrThrow.bind(Items);

export const Talisman: DisassemblySourceGroup = {
	name: 'Talisman',
	items: [
		{ item: i('Mind talisman'), lvl: 1 },
		{ item: i('Water talisman'), lvl: 5 },
		{ item: i('Earth talisman'), lvl: 9 },
		{ item: i('Fire talisman'), lvl: 14 },
		{ item: i('Body talisman'), lvl: 20 },
		{ item: i('Cosmic talisman'), lvl: 27 },
		{ item: i('Chaos talisman'), lvl: 35 },
		{ item: i('Nature talisman'), lvl: 44 },
		{ item: i('Law talisman'), lvl: 54 },
		{ item: i('Elemental talisman'), lvl: 58 },
		{ item: i('Death talisman'), lvl: 65 }
	],
	parts: { magic: 85, powerful: 2 }
};
