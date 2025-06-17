import type { CommandRunOptions } from '@oldschoolgg/toolkit/util';
import { ApplicationCommandOptionType, bold } from 'discord.js';
import { Time } from 'e';
import { Bank } from 'oldschooljs';

import { quests } from '../../lib/minions/data/quests';
import { courses } from '../../lib/skilling/skills/agility';
import { SkillsEnum } from '../../lib/skilling/types';
import type { AgilityActivityTaskOptions } from '../../lib/types/minions';
import { formatDuration, stringMatches } from '../../lib/util';
import addSubTaskToActivityTask from '../../lib/util/addSubTaskToActivityTask';
import { calcMaxTripLength } from '../../lib/util/calcMaxTripLength';
import { updateBankSetting } from '../../lib/util/updateBankSetting';
import { timePerAlchAgility } from '../lib/abstracted_commands/alchCommand';
import type { OSBMahojiCommand } from '../lib/util';
import { zeroTimeFletchables } from '../../lib/skilling/skills/fletching/fletchables';
import Arrows from '../../lib/skilling/skills/fletching/fletchables/arrows';
import Bolts from '../../lib/skilling/skills/fletching/fletchables/bolts';
import Darts from '../../lib/skilling/skills/fletching/fletchables/darts';
import Javelins from '../../lib/skilling/skills/fletching/fletchables/javelins';
import { AmethystBroadBolts, BroadArrows, BroadBolts } from '../../lib/skilling/skills/fletching/fletchables/slayer';
import TippedBolts from '../../lib/skilling/skills/fletching/fletchables/tippedBolts';
import TippedDragonBolts from '../../lib/skilling/skills/fletching/fletchables/tippedDragonBolts';
import type { Fletchable } from '../../lib/skilling/types';
import type { SlayerTaskUnlocksEnum } from '../../lib/slayer/slayerUnlocks';
import { hasSlayerUnlock } from '../../lib/slayer/slayerUtil';

const unlimitedFireRuneProviders = [
	'Staff of fire',
	'Fire battlestaff',
	'Mystic fire staff',
	'Lava battlestaff',
	'Mystic lava staff',
	'Steam battlestaff',
	'Mystic steam staff',
	'Smoke battlestaff',
	'Mystic smoke staff',
	'Tome of fire'
];

function alching(user: MUser, tripLength: number) {
	if (user.skillLevel(SkillsEnum.Magic) < 55) return null;
	const { bank } = user;
	const favAlchables = user.favAlchs(tripLength, true);

	if (favAlchables.length === 0) {
		return null;
	}

	const [itemToAlch] = favAlchables;

	const alchItemQty = bank.amount(itemToAlch.id);
	const nats = bank.amount('Nature rune');
	const fireRunes = bank.amount('Fire rune');

	const hasInfiniteFireRunes = user.hasEquipped(unlimitedFireRuneProviders);

	let maxCasts = Math.floor(tripLength / timePerAlchAgility);
	maxCasts = Math.min(alchItemQty, maxCasts);
	maxCasts = Math.min(nats, maxCasts);
	if (!hasInfiniteFireRunes) {
		maxCasts = Math.min(fireRunes / 5, maxCasts);
	}
	maxCasts = Math.floor(maxCasts);

	const bankToRemove = new Bank().add('Nature rune', maxCasts).add(itemToAlch.id, maxCasts);
	if (!hasInfiniteFireRunes) {
		bankToRemove.add('Fire rune', maxCasts * 5);
	}

	if (maxCasts === 0 || bankToRemove.length === 0) return null;

	const alchGP = itemToAlch.highalch! * maxCasts;
	const bankToAdd = new Bank().add('Coins', alchGP);

	return {
		maxCasts,
		bankToRemove,
		itemToAlch,
		bankToAdd
	};
}

export const lapsCommand: OSBMahojiCommand = {
	name: 'laps',
	description: 'Do laps on Agility courses to train Agility.',
	attributes: {
		requiresMinion: true,
		requiresMinionNotBusy: true,
		examples: ['/laps name:Ardougne rooftop course']
	},
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: 'name',
			description: 'The course you want to do laps on.',
			required: true,
			autocomplete: async (value: string) => {
				return courses
					.filter(i => (!value ? true : i.name.toLowerCase().includes(value.toLowerCase())))
					.map(i => ({
						name: i.name,
						value: i.name
					}));
			}
		},
		{
			type: ApplicationCommandOptionType.Integer,
			name: 'quantity',
			description: 'The quantity of laps you want to do (optional).',
			required: false,
			min_value: 1
		},
		{
			type: ApplicationCommandOptionType.Boolean,
			name: 'alch',
			description: 'Do you want to alch while doing agility? (optional).',
			required: false
		},
		{
			type: ApplicationCommandOptionType.Integer,
			name: 'fletching',
			description: 'The item you wish to fletch',
			required: false,
			autocomplete: async (value: number) => {
				const search = value?.toString() ?? '';
				return zeroTimeFletchables
					.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
					.map(i => ({ name: i.name, value: i.id }));
			}
		}
	],
        run: async ({
                options,
                userID,
                channelID
        }: CommandRunOptions<{ name: string; quantity?: number; alch?: boolean; fletching?: number }>) => {
                const user = await mUserFetch(userID);

               if (options.alch && options.fletching) {
                       return "You can't alch and fletch at the same time.";
               }

		const course = courses.find(
			course =>
				stringMatches(course.id.toString(), options.name) ||
				course.aliases.some(alias => stringMatches(alias, options.name))
		);

		if (!course) {
			return 'Thats not a valid course.';
		}

		if (user.skillLevel(SkillsEnum.Agility) < course.level) {
			return `${user.minionName} needs ${course.level} agility to train at ${course.name}.`;
		}

		if (course.qpRequired && user.QP < course.qpRequired) {
			return `You need at least ${course.qpRequired} Quest Points to do this course.`;
		}

		// Check for quest requirements
		if (course.requiredQuests) {
			const incompleteQuest = course.requiredQuests.find(quest => !user.user.finished_quest_ids.includes(quest));
			if (incompleteQuest) {
				return `You need to have completed the ${bold(
					quests.find(i => i.id === incompleteQuest)!.name
				)} quest to attempt the ${course.name} agility course.`;
			}
		}

		const maxTripLength = calcMaxTripLength(user, 'Agility');

		// If no quantity provided, set it to the max.
		const timePerLap = course.lapTime * Time.Second;
		let { quantity } = options;
		if (!quantity) {
			quantity = Math.floor(maxTripLength / timePerLap);
		}
		const duration = quantity * timePerLap;

		if (duration > maxTripLength) {
			return `${user.minionName} can't go on trips longer than ${formatDuration(
				maxTripLength
			)}, try a lower quantity. The highest amount of ${course.name} laps you can do is ${Math.floor(
				maxTripLength / timePerLap
			)}.`;
		}

		let fletchable: Fletchable | undefined;
		let fletchingQuantity = 0;
		let sets = '';
		let itemsNeeded: Bank | undefined;
		let timeToFletchSingleItem = 0;

		let response = `${user.minionName} is now doing ${quantity}x ${
			course.name
		} laps, it'll take around ${formatDuration(duration)} to finish.`;

		const alchResult = course.name === 'Ape Atoll Agility Course' || !options.alch ? null : alching(user, duration);
		if (alchResult !== null) {
			if (!user.owns(alchResult.bankToRemove)) {
				return `You don't own ${alchResult.bankToRemove}.`;
			}

			await user.removeItemsFromBank(alchResult.bankToRemove);
			response += `\n\nYour minion is alching ${alchResult.maxCasts}x ${alchResult.itemToAlch.name} while training. Removed ${alchResult.bankToRemove} from your bank.`;
			updateBankSetting('magic_cost_bank', alchResult.bankToRemove);
		}

		if (options.fletching) {
			fletchable = zeroTimeFletchables.find(item => item.id === Number(options.fletching));
			if (!fletchable) return 'That is not a valid item to fletch during agility.';

			if (user.skillLevel('fletching') < fletchable.level) {
				return `${user.minionName} needs ${fletchable.level} Fletching to fletch ${fletchable.name}.`;
			}

			if (fletchable.requiredSlayerUnlocks) {
				const { success, errors } = hasSlayerUnlock(
					user.user.slayer_unlocks as SlayerTaskUnlocksEnum[],
					fletchable.requiredSlayerUnlocks
				);
				if (!success) {
					return `You don't have the required Slayer Unlocks to create this item.\n\nRequired: ${errors}`;
				}
			}

			const fletchableTypes = [
				{ types: [Darts, Bolts, BroadBolts], time: Time.Second * 0.2 },
				{
					types: [Arrows, BroadArrows, Javelins, TippedBolts, TippedDragonBolts, AmethystBroadBolts],
					time: Time.Second * 0.36
				}
			];
			for (const { types, time } of fletchableTypes) {
				if (types.some(type => (Array.isArray(type) ? type.includes(fletchable!) : type === fletchable))) {
					timeToFletchSingleItem = time;
					break;
				}
			}
			if (timeToFletchSingleItem === 0) return 'Error selecting fletchable.';

			fletchingQuantity = Math.floor(duration / timeToFletchSingleItem);
			if (fletchable.outputMultiple) sets = ' sets of';

			const max = user.bank.fits(fletchable.inputItems);
			if (max < fletchingQuantity && max !== 0) fletchingQuantity = max;

			itemsNeeded = fletchable.inputItems.clone().multiply(fletchingQuantity);
			if (!user.bankWithGP.has(itemsNeeded)) {
				return `You don't have enough items. For ${fletchingQuantity}x ${fletchable.name}, you're missing **${itemsNeeded.clone().remove(user.bank)}**.`;
			}

			await user.removeItemsFromBank(itemsNeeded);
			response += `\n\nYou will also fletch ${fletchingQuantity}${sets} ${fletchable.name} while training. Removed ${itemsNeeded} from your bank.`;
		}

		await addSubTaskToActivityTask<AgilityActivityTaskOptions>({
			courseID: course.id,
			userID: user.id,
			channelID,
			quantity,
			duration,
			type: 'Agility',
			alch:
				alchResult === null
					? undefined
					: {
							itemID: alchResult.itemToAlch.id,
							quantity: alchResult.maxCasts
						},
			fletch: fletchable ? { id: fletchable.id, qty: fletchingQuantity } : undefined
		});

		return response;
	}
};
