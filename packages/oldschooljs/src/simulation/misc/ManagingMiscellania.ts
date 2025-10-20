export interface KingdomInputs {
	days: number;
	workers: number;
	category:
		| 'maple'
		| 'coal'
		| 'fish_raw'
		| 'fish_cooked'
		| 'herbs'
		| 'flax'
		| 'mahogany'
		| 'teak'
		| 'hardwood_both'
		| 'farm_seeds';
	startingApproval: number;
	royalTrouble: boolean;
	constantApproval: boolean;
	startingCoffer: number;
}

export interface CategoryEV {
	category: KingdomInputs['category'];
	evBank: Record<string, number>;
	evValue?: number;
}

export interface SimulatorResult {
	resourcePoints: number;
	cofferSpent: number;
	endingCoffer: number;
	endingApproval: number;
	byCategory: CategoryEV[];
}

type CategoryKey = KingdomInputs['category'];

interface RateRow {
	item: string;
	rate: number;
	maximum?: number;
}

interface CategoryConfig {
	inverseCost: number;
	build(baseQty: number, evBank: Record<string, number>): void;
}

const MAX_APPROVAL = 127;
const MIN_APPROVAL = 0;
const APPROVAL_FLOOR = 32;
const RESOURCE_POINT_CAP = 262_143;

const nestsRates: RateRow[] = [
	{ item: 'Bird nest (seed)', rate: 65 / 100 },
	{ item: 'Bird nest (ring)', rate: 32 / 100 },
	{ item: 'Bird nest (green egg)', rate: 1 / 100 },
	{ item: 'Bird nest (blue egg)', rate: 1 / 100 },
	{ item: 'Bird nest (red egg)', rate: 1 / 100 }
];

const miningGemRates: RateRow[] = [
	{ item: 'Uncut sapphire', rate: 32 / 58 },
	{ item: 'Uncut emerald', rate: 16 / 58 },
	{ item: 'Uncut ruby', rate: 8 / 58 },
	{ item: 'Uncut diamond', rate: 2 / 58 }
];

const fishingLootRates: RateRow[] = [
	{ item: 'Uncut sapphire', rate: 32 / 104 },
	{ item: 'Uncut emerald', rate: 16 / 104 },
	{ item: 'Uncut ruby', rate: 8 / 104 },
	{ item: 'Uncut diamond', rate: 2 / 104 },
	{ item: 'Casket', rate: 32 / 104 },
	{ item: 'Fremennik boots', rate: 4 / 104 },
	{ item: 'Fremennik gloves', rate: 4 / 104 },
	{ item: 'Loop half of key', rate: 1 / 104 },
	{ item: 'Tooth half of key', rate: 1 / 104 },
	{ item: 'Clue scroll (easy)', rate: 4 / 104 }
];

const herbRates: RateRow[] = [
	{ item: 'Grimy tarromin', rate: 10 / 46 },
	{ item: 'Grimy harralander', rate: 9 / 46 },
	{ item: 'Grimy irit leaf', rate: 6 / 46 },
	{ item: 'Grimy avantoe', rate: 6 / 46 },
	{ item: 'Grimy ranarr weed', rate: 3 / 46 },
	{ item: 'Grimy kwuarm', rate: 3 / 46 },
	{ item: 'Grimy cadantine', rate: 3 / 46 },
	{ item: 'Grimy dwarf weed', rate: 3 / 46 },
	{ item: 'Grimy lantadyme', rate: 3 / 46 }
];

const herbSeedRates: RateRow[] = [
	{ item: 'Guam seed', rate: 320 / 1000 },
	{ item: 'Marrentill seed', rate: 218 / 1000 },
	{ item: 'Tarromin seed', rate: 149 / 1000 },
	{ item: 'Harralander seed', rate: 101 / 1000 },
	{ item: 'Ranarr seed', rate: 69 / 1000, maximum: 2 },
	{ item: 'Toadflax seed', rate: 47 / 1000 },
	{ item: 'Irit seed', rate: 32 / 1000 },
	{ item: 'Avantoe seed', rate: 22 / 1000 },
	{ item: 'Kwuarm seed', rate: 15 / 1000 },
	{ item: 'Snapdragon seed', rate: 10 / 1000 },
	{ item: 'Cadantine seed', rate: 7 / 1000 },
	{ item: 'Lantadyme seed', rate: 5 / 1000 },
	{ item: 'Dwarf weed seed', rate: 3 / 1000 },
	{ item: 'Torstol seed', rate: 2 / 1000 }
];

const flaxSeedRates: RateRow[] = [
	{ item: 'Guam seed', rate: 320 / 1000 },
	{ item: 'Marrentill seed', rate: 218 / 1000 },
	{ item: 'Tarromin seed', rate: 149 / 1000 },
	{ item: 'Harralander seed', rate: 101 / 1000 },
	{ item: 'Ranarr seed', rate: 69 / 1000 },
	{ item: 'Toadflax seed', rate: 47 / 1000 },
	{ item: 'Irit seed', rate: 32 / 1000 },
	{ item: 'Avantoe seed', rate: 22 / 1000 },
	{ item: 'Kwuarm seed', rate: 15 / 1000 },
	{ item: 'Snapdragon seed', rate: 10 / 1000 },
	{ item: 'Cadantine seed', rate: 7 / 1000 },
	{ item: 'Lantadyme seed', rate: 5 / 1000 },
	{ item: 'Dwarf weed seed', rate: 3 / 1000 },
	{ item: 'Torstol seed', rate: 2 / 1000 }
];

const treeSeedRates: RateRow[] = [
	{ item: 'Acorn', rate: 214 / 1011, maximum: 4 },
	{ item: 'Apple tree seed', rate: 170 / 1011, maximum: 4 },
	{ item: 'Willow seed', rate: 135 / 1011, maximum: 4 },
	{ item: 'Banana tree seed', rate: 108 / 1011, maximum: 4 },
	{ item: 'Orange tree seed', rate: 85 / 1011, maximum: 4 },
	{ item: 'Curry tree seed', rate: 68 / 1011, maximum: 4 },
	{ item: 'Maple seed', rate: 54 / 1011, maximum: 4 },
	{ item: 'Pineapple seed', rate: 42 / 1011, maximum: 4 },
	{ item: 'Papaya tree seed', rate: 34 / 1011, maximum: 4 },
	{ item: 'Yew seed', rate: 27 / 1011, maximum: 4 },
	{ item: 'Palm tree seed', rate: 22 / 1011, maximum: 4 },
	{ item: 'Calquat tree seed', rate: 17 / 1011, maximum: 4 },
	{ item: 'Spirit seed', rate: 11 / 1011, maximum: 4 },
	{ item: 'Dragonfruit tree seed', rate: 6 / 1011, maximum: 4 },
	{ item: 'Magic seed', rate: 5 / 1011, maximum: 4 },
	{ item: 'Teak seed', rate: 4 / 1011, maximum: 4 },
	{ item: 'Mahogany seed', rate: 4 / 1011, maximum: 4 },
	{ item: 'Celastrus seed', rate: 3 / 1011, maximum: 4 },
	{ item: 'Redwood tree seed', rate: 2 / 1011, maximum: 4 }
];

const seedRates: RateRow[] = [
	{ item: 'Potato seed', rate: 1_567_735 / 8_858_315 },
	{ item: 'Onion seed', rate: 1_180_708 / 8_858_315 },
	{ item: 'Cabbage seed', rate: 619_972 / 8_858_315 },
	{ item: 'Tomato seed', rate: 561_932 / 8_858_315 },
	{ item: 'Barley seed', rate: 497_148 / 8_858_315 },
	{ item: 'Hammerstone seed', rate: 494_318 / 8_858_315 },
	{ item: 'Marigold seed', rate: 409_668 / 8_858_315 },
	{ item: 'Asgarnian seed', rate: 369_067 / 8_858_315 },
	{ item: 'Jute seed', rate: 368_455 / 8_858_315 },
	{ item: 'Redberry seed', rate: 343_409 / 8_858_315 },
	{ item: 'Nasturtium seed', rate: 270_351 / 8_858_315 },
	{ item: 'Yanillian seed', rate: 245_383 / 8_858_315 },
	{ item: 'Cadavaberry seed', rate: 242_164 / 8_858_315 },
	{ item: 'Sweetcorn seed', rate: 197_249 / 8_858_315 },
	{ item: 'Rosemary seed', rate: 173_977 / 8_858_315 },
	{ item: 'Dwellberry seed', rate: 172_110 / 8_858_315 },
	{ item: 'Guam seed', rate: 135_320 / 8_858_315 },
	{ item: 'Woad seed', rate: 129_804 / 8_858_315 },
	{ item: 'Krandorian seed', rate: 122_649 / 8_858_315 },
	{ item: 'Limpwurt seed', rate: 103_567 / 8_858_315 },
	{ item: 'Strawberry seed', rate: 97_042 / 8_858_315 },
	{ item: 'Marrentill seed', rate: 93_062 / 8_858_315 },
	{ item: 'Jangerberry seed', rate: 69_567 / 8_858_315 },
	{ item: 'Wildblood seed', rate: 62_976 / 8_858_315 },
	{ item: 'Tarromin seed', rate: 62_551 / 8_858_315 },
	{ item: 'Watermelon seed', rate: 47_071 / 8_858_315 },
	{ item: 'Harralander seed', rate: 43_198 / 8_858_315 },
	{ item: 'Snape grass seed', rate: 34_094 / 8_858_315 },
	{ item: 'Whiteberry seed', rate: 24_586 / 8_858_315 },
	{ item: 'Toadflax seed', rate: 19_990 / 8_858_315 },
	{ item: 'Mushroom spore', rate: 19_266 / 8_858_315 },
	{ item: 'Irit seed', rate: 14_019 / 8_858_315 },
	{ item: 'Belladonna seed', rate: 11_594 / 8_858_315 },
	{ item: 'Avantoe seed', rate: 9_229 / 8_858_315 },
	{ item: 'Poison ivy seed', rate: 9_199 / 8_858_315 },
	{ item: 'Cactus seed', rate: 7_850 / 8_858_315 },
	{ item: 'Kwuarm seed', rate: 6_599 / 8_858_315 },
	{ item: 'Ranarr seed', rate: 5_305 / 8_858_315, maximum: 2 },
	{ item: 'Snapdragon seed', rate: 3_901 / 8_858_315 },
	{ item: 'Potato cactus seed', rate: 3_790 / 8_858_315 },
	{ item: 'Cadantine seed', rate: 2_817 / 8_858_315 },
	{ item: 'Lantadyme seed', rate: 2_097 / 8_858_315 },
	{ item: 'Seaweed spore', rate: 1_508 / 8_858_315 },
	{ item: 'Dwarf weed seed', rate: 1_208 / 8_858_315 },
	{ item: 'Torstol seed', rate: 810 / 8_858_315 }
];

function addEV(evBank: Record<string, number>, item: string, amount: number) {
	if (amount <= 0) {
		return;
	}
	evBank[item] = (evBank[item] ?? 0) + amount;
}

function computeExpectedValueWithMax(trials: number, probability: number, maximum: number): number {
	if (trials <= 0 || probability <= 0) {
		return 0;
	}
	const n = Math.floor(trials);
	if (n <= 0) {
		return 0;
	}
	let ev = 0;
	let probabilityMass = 0;
	for (let k = 0; k < maximum; k++) {
		const combinations = choose(n, k);
		const probK = combinations * probability ** k * (1 - probability) ** (n - k);
		probabilityMass += probK;
		ev += k * probK;
	}
	return ev + (1 - probabilityMass) * maximum;
}

function choose(n: number, k: number): number {
	if (k < 0 || k > n) {
		return 0;
	}
	if (k === 0 || k === n) {
		return 1;
	}
	const limit = Math.min(k, n - k);
	let result = 1;
	for (let i = 0; i < limit; i++) {
		result = (result * (n - i)) / (i + 1);
	}
	return result;
}

function addFromRateTable(evBank: Record<string, number>, table: RateRow[], amount: number) {
	const rolls = Math.floor(amount);
	if (rolls <= 0) {
		return;
	}
	for (const row of table) {
		let ev = row.rate * rolls;
		if (row.maximum !== undefined) {
			ev = computeExpectedValueWithMax(rolls, row.rate, row.maximum);
		}
		addEV(evBank, row.item, ev);
	}
}

const categoryConfigs: Record<CategoryKey, CategoryConfig> = {
	maple: {
		inverseCost: 160,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addEV(evBank, 'Maple logs', baseQty);
			addFromRateTable(evBank, nestsRates, Math.min(999, Math.floor(baseQty / 100)));
		}
	},
	coal: {
		inverseCost: 98,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addEV(evBank, 'Coal', baseQty);
			addFromRateTable(evBank, miningGemRates, Math.floor(baseQty / 200 + 0.5));
		}
	},
	fish_raw: {
		inverseCost: 158,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addEV(evBank, 'Raw tuna', Math.floor(0.5 * baseQty));
			addEV(evBank, 'Raw swordfish', Math.floor(0.15 * baseQty));
			addFromRateTable(evBank, fishingLootRates, Math.floor(baseQty / 200));
		}
	},
	fish_cooked: {
		inverseCost: 158,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addEV(evBank, 'Tuna', Math.floor(0.5 * baseQty));
			addEV(evBank, 'Swordfish', Math.floor(0.15 * baseQty));
			addFromRateTable(evBank, fishingLootRates, Math.floor(baseQty / 200));
		}
	},
	herbs: {
		inverseCost: 11,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addFromRateTable(evBank, herbRates, baseQty);
			addFromRateTable(evBank, herbSeedRates, Math.floor(baseQty / 100));
		}
	},
	flax: {
		inverseCost: 224,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addEV(evBank, 'Flax', baseQty);
			addFromRateTable(evBank, flaxSeedRates, Math.floor(baseQty / 600));
		}
	},
	mahogany: {
		inverseCost: 40,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addEV(evBank, 'Mahogany logs', baseQty);
			addFromRateTable(evBank, nestsRates, Math.floor(baseQty / 350));
		}
	},
	teak: {
		inverseCost: 54,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addEV(evBank, 'Teak logs', baseQty);
			addFromRateTable(evBank, nestsRates, Math.floor(baseQty / 350));
		}
	},
	hardwood_both: {
		inverseCost: 47,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addEV(evBank, 'Mahogany logs', Math.floor(0.5 * baseQty));
			addEV(evBank, 'Teak logs', Math.floor(0.5 * baseQty));
			addFromRateTable(evBank, nestsRates, Math.floor(baseQty / 350));
		}
	},
	farm_seeds: {
		inverseCost: 86,
		build(baseQty, evBank) {
			if (baseQty <= 0) return;
			addFromRateTable(evBank, seedRates, baseQty);
			addFromRateTable(evBank, treeSeedRates, Math.floor(baseQty / 200));
		}
	}
};

function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function cofferReductionPerDay(coffer: number, royalTrouble: boolean): number {
	const maxReduction = royalTrouble ? 75_000 : 50_000;
	const sanitizedCoffer = Math.max(0, Math.floor(coffer));
	if (sanitizedCoffer <= 0) {
		return 0;
	}
	const baseReduction = 5 + Math.floor(sanitizedCoffer / 10);
	return Math.min(baseReduction, maxReduction, sanitizedCoffer);
}

export function applyApprovalDecay(
	approval: number,
	days: number,
	royalTrouble: boolean,
	constantApproval: boolean
): number {
	let current = clamp(Math.floor(approval), MIN_APPROVAL, MAX_APPROVAL);
	if (constantApproval) {
		return current;
	}
	const steps = Math.max(0, Math.floor(days));
	const subtraction = royalTrouble ? 131 : 160;
	for (let i = 0; i < steps; i++) {
		if (current <= APPROVAL_FLOOR) {
			break;
		}
		const decay = Math.ceil((subtraction - current) / 15);
		current = Math.max(APPROVAL_FLOOR, current - decay);
	}
	return current;
}

function calculateResourcePoints(inputs: KingdomInputs) {
	const maxWorkers = inputs.royalTrouble ? 15 : 10;
	const days = Math.min(30, Math.max(0, Math.floor(inputs.days)));
	const workers = clamp(Math.floor(inputs.workers), 0, maxWorkers);
	let approval = clamp(Math.floor(inputs.startingApproval), MIN_APPROVAL, MAX_APPROVAL);
	let coffer = Math.max(0, Math.floor(inputs.startingCoffer));
	let resourcePoints = 0;
	const favourSubtraction = inputs.royalTrouble ? 131 : 160;

	for (let i = 0; i < days; i++) {
		const reduction = cofferReductionPerDay(coffer, inputs.royalTrouble);
		coffer -= reduction;
		const workerEffectiveness = Math.floor((reduction * 100) / 8333);
		resourcePoints += Math.floor((workerEffectiveness * approval) / 100);

		if (!inputs.constantApproval && approval > APPROVAL_FLOOR) {
			const decay = Math.ceil((favourSubtraction - approval) / 15);
			approval = Math.max(APPROVAL_FLOOR, approval - decay);
		}
	}

	return {
		resourcePoints: Math.min(RESOURCE_POINT_CAP, resourcePoints),
		endingApproval: approval,
		endingCoffer: coffer,
		workers,
		days
	};
}

export function simulateEV(inputs: KingdomInputs): SimulatorResult {
	const { resourcePoints, endingApproval, endingCoffer, workers } = calculateResourcePoints(inputs);
	const startingCoffer = Math.max(0, Math.floor(inputs.startingCoffer));
	const cofferSpent = Math.max(0, startingCoffer - endingCoffer);
	const category = inputs.category;
	const evBank: Record<string, number> = {};

	const config = categoryConfigs[category];
	if (config && resourcePoints > 0 && workers > 0) {
		const baseQty = Math.floor((workers * config.inverseCost * resourcePoints) / 2048);
		config.build(baseQty, evBank);
	}

	return {
		resourcePoints,
		cofferSpent,
		endingCoffer,
		endingApproval,
		byCategory: [
			{
				category,
				evBank
			}
		]
	};
}
