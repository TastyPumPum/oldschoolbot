import { Bank, Items } from 'oldschooljs';

export type SailingShipType = 'raft' | 'skiff' | 'sloop';
export type SailingStructuralSlot = 'hull' | 'helm' | 'keel' | 'mast_sails';
export type SailingHullTier = 'wooden' | 'oak' | 'teak' | 'mahogany' | 'camphor' | 'ironwood' | 'rosewood';
export type SailingMetalTier = 'bronze' | 'iron' | 'steel' | 'mithril' | 'adamant' | 'rune' | 'dragon';
export type SailingMastSailsTier =
	| 'wooden_linen'
	| 'oak_linen'
	| 'teak_canvas'
	| 'mahogany_canvas'
	| 'camphor_canvas'
	| 'ironwood_cotton'
	| 'rosewood_cotton';
export type SailingStructuralTier = SailingHullTier | SailingMetalTier | SailingMastSailsTier;

export type SailingShipParts = {
	shipType?: SailingShipType;
	hull?: SailingHullTier;
	helm?: SailingMetalTier;
	keel?: SailingMetalTier;
	mast_sails?: SailingMastSailsTier;
};

export type SailingCost = Record<string, number>;

export interface SailingShipTypeDefinition {
	id: SailingShipType;
	name: string;
	sailingLevel: number;
	facilityHotspots: number;
	structuralSlots: SailingStructuralSlot[];
}

export interface SailingStructuralPart {
	id: string;
	slot: SailingStructuralSlot;
	shipType: SailingShipType;
	tier: SailingStructuralTier;
	name: string;
	level: number;
	constructionLevel: number;
	cost: SailingCost;
	effects: string[];
}

export const SailingShipTypes: SailingShipTypeDefinition[] = [
	{
		id: 'raft',
		name: 'Raft',
		sailingLevel: 1,
		facilityHotspots: 1,
		structuralSlots: ['hull', 'helm', 'mast_sails']
	},
	{
		id: 'skiff',
		name: 'Skiff',
		sailingLevel: 15,
		facilityHotspots: 7,
		structuralSlots: ['hull', 'helm', 'keel', 'mast_sails']
	},
	{
		id: 'sloop',
		name: 'Sloop',
		sailingLevel: 50,
		facilityHotspots: 13,
		structuralSlots: ['hull', 'helm', 'keel', 'mast_sails']
	}
];

export const SailingShipTypeById = new Map(SailingShipTypes.map(ship => [ship.id, ship]));

const hullTiers: Array<{
	tier: SailingHullTier;
	name: string;
	level: number;
	constructionLevel: number;
	speed: number;
	skiffHP: number;
	sloopHP: number;
	material: string;
	nails: string;
	extra?: SailingCost;
}> = [
	{
		tier: 'wooden',
		name: 'Wooden',
		level: 1,
		constructionLevel: 1,
		speed: 1.5,
		skiffHP: 30,
		sloopHP: 40,
		material: 'Logs',
		nails: 'Bronze nails'
	},
	{
		tier: 'oak',
		name: 'Oak',
		level: 20,
		constructionLevel: 8,
		speed: 1.5,
		skiffHP: 45,
		sloopHP: 60,
		material: 'Oak logs',
		nails: 'Iron nails'
	},
	{
		tier: 'teak',
		name: 'Teak',
		level: 31,
		constructionLevel: 23,
		speed: 2,
		skiffHP: 60,
		sloopHP: 80,
		material: 'Teak logs',
		nails: 'Steel nails',
		extra: { 'Lead bar': 5 }
	},
	{
		tier: 'mahogany',
		name: 'Mahogany',
		level: 48,
		constructionLevel: 41,
		speed: 2,
		skiffHP: 75,
		sloopHP: 100,
		material: 'Mahogany logs',
		nails: 'Mithril nails',
		extra: { 'Lead bar': 5 }
	},
	{
		tier: 'camphor',
		name: 'Camphor',
		level: 67,
		constructionLevel: 59,
		speed: 2.5,
		skiffHP: 120,
		sloopHP: 160,
		material: 'Camphor logs',
		nails: 'Adamantite nails',
		extra: { 'Lead bar': 5 }
	},
	{
		tier: 'ironwood',
		name: 'Ironwood',
		level: 81,
		constructionLevel: 75,
		speed: 2.5,
		skiffHP: 150,
		sloopHP: 200,
		material: 'Ironwood logs',
		nails: 'Rune nails',
		extra: { 'Cupronickel bar': 5 }
	},
	{
		tier: 'rosewood',
		name: 'Rosewood',
		level: 93,
		constructionLevel: 84,
		speed: 3,
		skiffHP: 180,
		sloopHP: 240,
		material: 'Rosewood logs',
		nails: 'Dragon nails',
		extra: { 'Cupronickel bar': 5 }
	}
];

const helmTiers: Array<{
	tier: SailingMetalTier;
	name: string;
	level: number;
	constructionLevel: number;
	plank: string;
	bar: string;
	effects: string[];
}> = [
	{
		tier: 'bronze',
		name: 'Bronze',
		level: 1,
		constructionLevel: 1,
		plank: 'Plank',
		bar: 'Bronze bar',
		effects: ['No rapid-current protection']
	},
	{
		tier: 'iron',
		name: 'Iron',
		level: 17,
		constructionLevel: 14,
		plank: 'Oak plank',
		bar: 'Iron bar',
		effects: ['Gentle rapids']
	},
	{
		tier: 'steel',
		name: 'Steel',
		level: 38,
		constructionLevel: 30,
		plank: 'Teak plank',
		bar: 'Steel bar',
		effects: ['Gentle rapids']
	},
	{
		tier: 'mithril',
		name: 'Mithril',
		level: 55,
		constructionLevel: 47,
		plank: 'Mahogany plank',
		bar: 'Mithril bar',
		effects: ['Strong rapids']
	},
	{
		tier: 'adamant',
		name: 'Adamant',
		level: 72,
		constructionLevel: 59,
		plank: 'Camphor plank',
		bar: 'Adamantite bar',
		effects: ['Strong rapids', 'Tangled kelp protection']
	},
	{
		tier: 'rune',
		name: 'Rune',
		level: 87,
		constructionLevel: 81,
		plank: 'Ironwood plank',
		bar: 'Runite bar',
		effects: ['Powerful rapids', 'Tangled kelp protection']
	},
	{
		tier: 'dragon',
		name: 'Dragon',
		level: 96,
		constructionLevel: 86,
		plank: 'Rosewood plank',
		bar: 'Dragon metal sheet',
		effects: ['Deadly rapids', 'Tangled kelp protection']
	}
];

const mastSailsTiers: Array<{
	tier: SailingMastSailsTier;
	name: string;
	level: number;
	constructionLevel: number;
	log: string;
	nails: string;
	bolt: string;
	boostTicks: number;
	acceleration: number;
	stormProtection: 'none' | 'partial' | 'full';
}> = [
	{
		tier: 'wooden_linen',
		name: 'Wooden mast and linen sails',
		level: 1,
		constructionLevel: 1,
		log: 'Logs',
		nails: 'Bronze nails',
		bolt: 'Bolt of linen',
		boostTicks: 20,
		acceleration: 0.5,
		stormProtection: 'none'
	},
	{
		tier: 'oak_linen',
		name: 'Oak mast and linen sails',
		level: 24,
		constructionLevel: 11,
		log: 'Oak logs',
		nails: 'Iron nails',
		bolt: 'Bolt of linen',
		boostTicks: 22,
		acceleration: 0.5,
		stormProtection: 'partial'
	},
	{
		tier: 'teak_canvas',
		name: 'Teak mast and canvas sails',
		level: 36,
		constructionLevel: 26,
		log: 'Teak logs',
		nails: 'Steel nails',
		bolt: 'Bolt of canvas',
		boostTicks: 24,
		acceleration: 0.5,
		stormProtection: 'partial'
	},
	{
		tier: 'mahogany_canvas',
		name: 'Mahogany mast and canvas sails',
		level: 52,
		constructionLevel: 45,
		log: 'Mahogany logs',
		nails: 'Mithril nails',
		bolt: 'Bolt of canvas',
		boostTicks: 27,
		acceleration: 0.5,
		stormProtection: 'partial'
	},
	{
		tier: 'camphor_canvas',
		name: 'Camphor mast and canvas sails',
		level: 68,
		constructionLevel: 60,
		log: 'Camphor logs',
		nails: 'Adamantite nails',
		bolt: 'Bolt of canvas',
		boostTicks: 30,
		acceleration: 1,
		stormProtection: 'full'
	},
	{
		tier: 'ironwood_cotton',
		name: 'Ironwood mast and cotton sails',
		level: 83,
		constructionLevel: 77,
		log: 'Ironwood logs',
		nails: 'Rune nails',
		bolt: 'Bolt of cotton',
		boostTicks: 33,
		acceleration: 1,
		stormProtection: 'full'
	},
	{
		tier: 'rosewood_cotton',
		name: 'Rosewood mast and cotton sails',
		level: 94,
		constructionLevel: 85,
		log: 'Rosewood logs',
		nails: 'Dragon nails',
		bolt: 'Bolt of cotton',
		boostTicks: 36,
		acceleration: 1,
		stormProtection: 'full'
	}
];

const keelTiers: Array<{
	tier: SailingMetalTier;
	name: string;
	level: number;
	constructionLevel: number;
	armour: number;
	skiffHP: number;
	sloopHP: number;
	extra?: SailingCost;
	effects: string[];
}> = [
	{
		tier: 'bronze',
		name: 'Bronze',
		level: 15,
		constructionLevel: 1,
		armour: 100,
		skiffHP: 50,
		sloopHP: 70,
		effects: []
	},
	{
		tier: 'iron',
		name: 'Iron',
		level: 22,
		constructionLevel: 17,
		armour: 200,
		skiffHP: 50,
		sloopHP: 70,
		effects: []
	},
	{
		tier: 'steel',
		name: 'Steel',
		level: 39,
		constructionLevel: 32,
		armour: 300,
		skiffHP: 60,
		sloopHP: 90,
		extra: { 'Lead bar': 5 },
		effects: []
	},
	{
		tier: 'mithril',
		name: 'Mithril',
		level: 54,
		constructionLevel: 50,
		armour: 400,
		skiffHP: 60,
		sloopHP: 90,
		extra: { 'Lead bar': 5 },
		effects: []
	},
	{
		tier: 'adamant',
		name: 'Adamant',
		level: 66,
		constructionLevel: 62,
		armour: 600,
		skiffHP: 70,
		sloopHP: 100,
		extra: { 'Lead bar': 5 },
		effects: ['Crystal-flecked water protection']
	},
	{
		tier: 'rune',
		name: 'Rune',
		level: 85,
		constructionLevel: 78,
		armour: 800,
		skiffHP: 80,
		sloopHP: 120,
		extra: { 'Cupronickel bar': 5 },
		effects: ['Crystal-flecked water protection']
	},
	{
		tier: 'dragon',
		name: 'Dragon',
		level: 97,
		constructionLevel: 87,
		armour: 1000,
		skiffHP: 80,
		sloopHP: 120,
		extra: { 'Cupronickel bar': 5 },
		effects: ['Crystal-flecked water protection']
	}
];

function mergeCosts(...costs: Array<SailingCost | undefined>): SailingCost {
	const result: SailingCost = {};
	for (const cost of costs) {
		if (!cost) continue;
		for (const [item, quantity] of Object.entries(cost)) {
			result[item] = (result[item] ?? 0) + quantity;
		}
	}
	return result;
}

function titleCase(value: string) {
	return value[0].toUpperCase() + value.slice(1);
}

const shipLabel: Record<SailingShipType, string> = {
	raft: 'raft',
	skiff: 'skiff',
	sloop: 'sloop'
};

const hullParts: SailingStructuralPart[] = hullTiers.flatMap(tier => [
	{
		id: `${tier.tier}_raft_hull`,
		slot: 'hull',
		shipType: 'raft',
		tier: tier.tier,
		name: `${tier.name} raft`,
		level: tier.level,
		constructionLevel: tier.constructionLevel,
		cost: mergeCosts({ [tier.material]: 10, Rope: 6, 'Swamp tar': 10 }, tier.extra),
		effects: [`Speed ${tier.speed}`]
	},
	{
		id: `${tier.tier}_skiff_hull`,
		slot: 'hull',
		shipType: 'skiff',
		tier: tier.tier,
		name: `${tier.name} skiff`,
		level: tier.level,
		constructionLevel: tier.constructionLevel,
		cost: mergeCosts({ [`${tier.name} hull parts`]: 10, [tier.nails]: 300, 'Swamp tar': 20 }, tier.extra),
		effects: [`Speed ${tier.speed}`, `+${tier.skiffHP} HP`]
	},
	{
		id: `${tier.tier}_sloop_hull`,
		slot: 'hull',
		shipType: 'sloop',
		tier: tier.tier,
		name: `${tier.name} sloop`,
		level: tier.level,
		constructionLevel: tier.constructionLevel,
		cost: mergeCosts({ [`Large ${tier.tier} hull parts`]: 16, [tier.nails]: 600, 'Swamp tar': 25 }, tier.extra),
		effects: [`Speed ${tier.speed}`, `+${tier.sloopHP} HP`]
	}
]);

const helmParts: SailingStructuralPart[] = helmTiers.flatMap(tier =>
	(['raft', 'skiff', 'sloop'] as const).map(shipType => {
		const multiplier = shipType === 'raft' ? 2 : shipType === 'skiff' ? 3 : 4;
		return {
			id: `${tier.tier}_${shipType}_helm`,
			slot: 'helm',
			shipType,
			tier: tier.tier,
			name: `${tier.name} ${shipLabel[shipType]} helm`,
			level: tier.level,
			constructionLevel: tier.constructionLevel,
			cost: { [tier.plank]: multiplier, [tier.bar]: multiplier * 2 },
			effects: tier.effects
		};
	})
);

const mastSailsParts: SailingStructuralPart[] = mastSailsTiers.flatMap(tier =>
	(['raft', 'skiff', 'sloop'] as const).map(shipType => {
		const logQuantity = shipType === 'raft' ? 5 : shipType === 'skiff' ? 10 : 15;
		const nailQuantity = shipType === 'raft' ? 20 : shipType === 'skiff' ? 40 : 60;
		const boltQuantity = shipType === 'sloop' ? 10 : 5;
		return {
			id: `${tier.tier}_${shipType}`,
			slot: 'mast_sails',
			shipType,
			tier: tier.tier,
			name: `${tier.name} (${shipLabel[shipType]})`,
			level: tier.level,
			constructionLevel: tier.constructionLevel,
			cost: { [tier.log]: logQuantity, [tier.nails]: nailQuantity, [tier.bolt]: boltQuantity },
			effects: [
				`Boost ${tier.boostTicks} ticks`,
				`Acceleration +${tier.acceleration}`,
				`${titleCase(tier.stormProtection)} storm protection`
			]
		};
	})
);

const keelParts: SailingStructuralPart[] = keelTiers.flatMap(tier =>
	(['skiff', 'sloop'] as const).map(shipType => ({
		id: `${tier.tier}_${shipType}_keel`,
		slot: 'keel',
		shipType,
		tier: tier.tier,
		name: `${tier.name} ${shipLabel[shipType]} keel`,
		level: tier.level,
		constructionLevel: tier.constructionLevel,
		cost: mergeCosts(
			{
				[`${tier.name} ${shipLabel[shipType]} keel parts`]: shipType === 'skiff' ? 10 : 16
			},
			tier.extra
		),
		effects: [
			`+${shipType === 'skiff' ? tier.skiffHP : tier.sloopHP} HP`,
			`+${tier.armour.toLocaleString()} armour`,
			...tier.effects
		]
	}))
);

export const SailingStructuralParts: SailingStructuralPart[] = [
	...hullParts,
	...helmParts,
	...mastSailsParts,
	...keelParts
];

export const SailingStructuralPartById = new Map(SailingStructuralParts.map(part => [part.id, part]));

const hullTierOrder: SailingHullTier[] = ['wooden', 'oak', 'teak', 'mahogany', 'camphor', 'ironwood', 'rosewood'];
const metalTierOrder: SailingMetalTier[] = ['bronze', 'iron', 'steel', 'mithril', 'adamant', 'rune', 'dragon'];
const mastSailsTierOrder: SailingMastSailsTier[] = [
	'wooden_linen',
	'oak_linen',
	'teak_canvas',
	'mahogany_canvas',
	'camphor_canvas',
	'ironwood_cotton',
	'rosewood_cotton'
];

function tierOrder(slot: SailingStructuralSlot) {
	if (slot === 'hull') return hullTierOrder;
	if (slot === 'mast_sails') return mastSailsTierOrder;
	return metalTierOrder;
}

export function tierMeetsRequirement(
	slot: SailingStructuralSlot,
	current: SailingStructuralTier | undefined,
	required: SailingStructuralTier
) {
	if (!current) return false;
	const order = tierOrder(slot);
	return order.indexOf(current as never) >= order.indexOf(required as never);
}

export function getDefaultShipParts(
	shipType: SailingShipType = 'raft'
): Required<Pick<SailingShipParts, 'shipType' | 'hull' | 'helm' | 'mast_sails'>> & Pick<SailingShipParts, 'keel'> {
	return {
		shipType,
		hull: 'wooden',
		helm: 'bronze',
		mast_sails: 'wooden_linen',
		keel: shipType === 'raft' ? undefined : 'bronze'
	};
}

export function normaliseShipParts(
	parts?: SailingShipParts,
	fallbackShipType: SailingShipType = 'raft'
): SailingShipParts {
	const shipType = parts?.shipType ?? fallbackShipType;
	return {
		...getDefaultShipParts(shipType),
		...parts,
		shipType,
		keel: shipType === 'raft' ? undefined : (parts?.keel ?? 'bronze')
	};
}

export function getInstalledStructuralPart(parts: SailingShipParts, slot: SailingStructuralSlot) {
	const normalised = normaliseShipParts(parts);
	const shipType = normalised.shipType ?? 'raft';
	const tier = normalised[slot];
	if (!tier) return null;
	return SailingStructuralParts.find(part => part.shipType === shipType && part.slot === slot && part.tier === tier);
}

export function bankFromSailingCost(cost: SailingCost) {
	const bank = new Bank();
	const missingItems: string[] = [];
	for (const [itemName, quantity] of Object.entries(cost)) {
		if (!Items.getItem(itemName)) {
			missingItems.push(`${quantity.toLocaleString()}x ${itemName}`);
			continue;
		}
		bank.add(itemName, quantity);
	}
	return { bank, missingItems };
}
