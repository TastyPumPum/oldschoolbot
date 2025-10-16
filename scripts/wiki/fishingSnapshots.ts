import { SeedableRNG } from '@oldschoolgg/rng';
import { calcPerHour, Table, Time } from '@oldschoolgg/toolkit';
import { type Bank, convertLVLtoXP, EItem, Items } from 'oldschooljs';
import { uniqueBy } from 'remeda';

import '../../src/lib/safeglobals.js';

import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';
import type { Fish } from '@/lib/skilling/types.js';
import { ClueTiers } from '../../src/lib/clues/clueTiers.js';
import { FloatBank } from '../../src/lib/structures/Bank.js';
import { makeGearBank } from '../../tests/unit/utils.js';
import { tearDownScript } from '../scriptUtil.js';
import { handleMarkdownEmbed } from './wikiScriptUtil.js';

function bankToPerHour(bank: Bank, duration: number): FloatBank {
	const perHourBank = new FloatBank();
	for (const [item, qty] of bank.items()) {
		perHourBank.add(item.id, qty / (duration / Time.Hour));
	}
	return perHourBank;
}

function makeFishingGearBank({ fishingLevel }: { fishingLevel: number }) {
	const gearBank = makeGearBank();

	if (fishingLevel >= 34) {
		gearBank.gear.skilling.equip('Angler hat');
		gearBank.gear.skilling.equip('Angler top');
		gearBank.gear.skilling.equip('Angler waders');
		gearBank.gear.skilling.equip('Angler boots');
	}

	gearBank.bank.add(EItem.SPIRIT_FLAKES, 100_000);
	for (const fish of Fishing.Fishes) {
		if (fish.bait) gearBank.bank.add(fish.bait, 100_000);
	}

	gearBank.skillsAsLevels.fishing = fishingLevel;
	gearBank.skillsAsXP.fishing = convertLVLtoXP(fishingLevel);
	return gearBank;
}

function getDisplayItemID(fish: Fish) {
	if (!fish.subfishes || fish.subfishes.length === 0) {
		return fish.id ?? EItem.RAW_SHRIMPS;
	}
	return fish.subfishes[0].id;
}

function renderFishingXpHrTable() {
	const results: {
		xpHr: number;
		hasPearlRod: boolean;
		fish: Fish;
		level: number;
		itemsPerHour: FloatBank | null;
	}[] = [];

	for (const level of [1, 10, 40, 70, 80, 90, 99]) {
		for (const fish of Fishing.Fishes) {
			if (!fish.subfishes || fish.subfishes.length === 0) continue;
			const mainSubfish = fish.subfishes[0];

			for (const hasPearlRod of [true, false]) {
				const isBarbFishing = fish.name === 'Barbarian fishing';
				if (mainSubfish.level > level) continue;
				if ((!fish.bait || isBarbFishing) && hasPearlRod) continue;
				if (mainSubfish.id === EItem.RAW_SHRIMPS && level > 1) continue;
				if (
					[EItem.RAW_ANCHOVIES, EItem.RAW_MACKEREL, EItem.RAW_HERRING, EItem.RAW_SARDINE].includes(
						mainSubfish.id
					) &&
					level > 40
				) {
					continue;
				}

				const gearBank = makeFishingGearBank({ fishingLevel: level });

				if (level >= 71) {
					gearBank.gear.skilling.equip('Crystal harpoon');
				}

				if (hasPearlRod && level >= 43) {
					gearBank.bank.add('Pearl fishing rod');
					gearBank.bank.add('Pearl fly fishing rod');
				}

				const tripLengthHours = 3000;

				const rng = new SeedableRNG(1);

				const trip = Fishing.util.calcFishingTripStart({
					gearBank,
					fish,
					maxTripLength: Time.Hour * tripLengthHours,
					quantityInput: undefined,
					wantsToUseFlakes: false,
					powerfish: false,
					hasWildyEliteDiary: false,
					rng
				});
				if (typeof trip === 'string') throw new Error(`Error calculating trip: ${trip}`);
				const result = Fishing.util.calcFishingTripResult({
					fish,
					catches: trip.catches,
					loot: trip.loot,
					gearBank,
					duration: trip.duration,
					rng,
					blessingExtra: trip.blessingExtra,
					flakeExtra: trip.flakeExtra
				});
				result.updateBank.itemLootBank.remove('Heron', result.updateBank.itemLootBank.amount('Heron'));

				for (const clueTier of ClueTiers) {
					result.updateBank.itemLootBank.remove(
						clueTier.scrollID,
						result.updateBank.itemLootBank.amount(clueTier.scrollID)
					);
				}

				const xp = result.updateBank.xpBank.amount('fishing');
				let xpHr = calcPerHour(xp, trip.duration);
				xpHr = Math.floor(xpHr / 1000) * 1000;

				results.push({
					xpHr,
					hasPearlRod,
					fish,
					level,
					itemsPerHour: isBarbFishing ? null : bankToPerHour(result.updateBank.itemLootBank, trip.duration)
				});
			}
		}
	}

	results.sort((a, b) => a.fish.name.localeCompare(b.fish.name));
	results.sort((a, b) => b.xpHr - a.xpHr);

	const table = new Table();
	table.addHeader('Fish', 'Fishing Lvl', 'XP/hr', 'Items/hr');

	for (const result of uniqueBy(results, r => `${r.fish.name}-${r.xpHr}`)) {
		const itemID = getDisplayItemID(result.fish);
		const fishName =
			result.fish.name === 'Barbarian fishing'
				? 'Barbarian fishing'
				: `[[${Items.itemNameFromId(itemID)}?raw]] ${result.fish.name}`;
		table.addRow(
			`${fishName}`,
			result.level.toString(),
			result.xpHr.toLocaleString(),
			result.itemsPerHour?.toItemBankRoundedUp().toString().replace('No items', '') ?? ''
		);
	}

	handleMarkdownEmbed('fishingxphr', 'osb/Skills/fishing.mdx', table.toString());
}

renderFishingXpHrTable();
tearDownScript();
