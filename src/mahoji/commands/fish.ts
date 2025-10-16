import { formatDuration, stringSearch } from '@oldschoolgg/toolkit';
import { Monsters } from 'oldschooljs';

import { userhasDiaryTier, WildernessDiary } from '@/lib/diaries.js';
import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';
import { anglerItemsArr } from '@/lib/skilling/skills/fishing/fishingUtil.js';
import type { FishingActivityTaskOptions } from '@/lib/types/minions.js';
import { formatSkillRequirements } from '@/lib/util/smallUtils.js';

export const fishCommand: OSBMahojiCommand = {
	name: 'fish',
	description: 'Send your minion to fish fish.',
	attributes: {
		requiresMinion: true,
		requiresMinionNotBusy: true,
		examples: ['/fish name:Shrimp']
	},
	options: [
		{
			type: 'String',
			name: 'name',
			description: 'The thing you want to fish.',
			required: true,
			autocomplete: async (value: string) => {
				return Fishing.Fishes.filter(i =>
					!value ? true : i.name.toLowerCase().includes(value.toLowerCase())
				).map(i => ({
					name: i.name,
					value: i.name
				}));
			}
		},
		{
			type: 'Integer',
			name: 'quantity',
			description: 'The quantity you want to fish (optional).',
			required: false,
			min_value: 1
		},
		{
			type: 'Boolean',
			name: 'powerfish',
			description: 'Powerfish for higher XP/hour at the cost of banking any loot.',
			required: false
		},
		{
			type: 'Boolean',
			name: 'spirit_flakes',
			description: 'Use Spirit flakes for a 50% chance at extra fish.',
			required: false
		}
	],
	run: async ({
		options,
		user,
		channelID
	}: CommandRunOptions<{
		name: string;
		quantity?: number;
		powerfish?: boolean;
		spirit_flakes?: boolean;
	}>) => {
		const spot = Fishing.Fishes.find(fish => stringSearch(fish.name, options.name));
		if (!spot) {
			return 'Thats not a valid spot you can fish at.';
		}

		if (!spot.subfishes || spot.subfishes.length === 0) {
			return `${spot.name} is not supported yet.`;
		}

		const minimumFishingLevel = spot.subfishes[0]?.level ?? 1;
		if (user.skillsAsLevels.fishing < minimumFishingLevel) {
			return `${user.minionName} needs ${minimumFishingLevel} Fishing to fish ${spot.name}.`;
		}

		if (spot.skillReqs && !user.hasSkillReqs(spot.skillReqs)) {
			return `To fish ${spot.name}, you need ${formatSkillRequirements(spot.skillReqs)}.`;
		}

		if (spot.qpRequired && user.QP < spot.qpRequired) {
			return `You need ${spot.qpRequired} qp to catch those!`;
		}

		if (spot.name === 'Infernal eel') {
			const jadKC = await user.getKC(Monsters.TzTokJad.id);
			if (jadKC === 0) {
				return 'You are not worthy JalYt. Before you can fish Infernal Eels, you need to have defeated the mighty TzTok-Jad!';
			}
		}

		if (spot.name === 'Minnow' && anglerItemsArr.some(piece => !user.hasEquippedOrInBank(piece.id))) {
			return 'You need to own the Angler Outfit to fish for Minnows.';
		}

		const maxTripLength = user.calcMaxTripLength('Fishing');
		const [hasWildyEliteDiary] = await userhasDiaryTier(user, WildernessDiary.elite);

		const result = Fishing.util.calcFishingTripStart({
			gearBank: user.gearBank,
			fish: spot,
			maxTripLength,
			quantityInput: options.quantity,
			wantsToUseFlakes: Boolean(options.spirit_flakes),
			powerfish: Boolean(options.powerfish),
			hasWildyEliteDiary
		});

		if (typeof result === 'string') {
			return result;
		}

		await ActivityManager.startTrip<FishingActivityTaskOptions>({
			fishID: spot.name,
			userID: user.id,
			channelID,
			quantity: result.quantity,
			Qty: result.catches,
			loot: result.loot,
			flakesToRemove: result.flakesBeingUsed,
			powerfish: Boolean(options.powerfish),
			spiritFlakes: result.isUsingSpiritFlakes,
			iQty: options.quantity ? options.quantity : undefined,
			duration: result.duration,
			type: 'Fishing'
		});

		let response = `${user.minionName} is now fishing ${spot.name}, it'll take around ${formatDuration(result.duration)} to finish.`;

		if (result.boosts.length > 0) {
			response += `\n\n**Boosts:** ${result.boosts.join(', ')}.`;
		}

		return response;
	}
};
