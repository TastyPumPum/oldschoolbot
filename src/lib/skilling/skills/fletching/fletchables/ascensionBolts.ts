import { Bank, itemID } from 'oldschooljs';

import type { Fletchable } from '@/lib/skilling/types.js';

// Each action makes ten bolts. The shard recipe needs no feathers.
const AscensionBolts: Fletchable[] = [
	{
		name: 'Ascension bolts',
		id: itemID('Ascension bolts'),
		level: 86,
		xp: 140,
		inputItems: new Bank().add('Ascension shards'),
		tickRate: 2,
		outputMultiple: 10
	},
	{
		name: 'Diamond ascension bolts',
		id: itemID('Diamond ascension bolts'),
		level: 86,
		xp: 70,
		inputItems: new Bank().add('Ascension bolts', 10).add('Diamond bolt tips', 10),
		tickRate: 2,
		outputMultiple: 10
	},
	{
		name: 'Onyx ascension bolts',
		id: itemID('Onyx ascension bolts'),
		level: 86,
		xp: 94,
		inputItems: new Bank().add('Ascension bolts', 10).add('Onyx bolt tips', 10),
		tickRate: 2,
		outputMultiple: 10
	}
];

export default AscensionBolts;
