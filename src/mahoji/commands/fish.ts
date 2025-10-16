import { formatDuration, stringSearch } from '@oldschoolgg/toolkit';
import { ItemGroups, Monsters } from 'oldschooljs';

import { userhasDiaryTier, WildernessDiary } from '@/lib/diaries.js';
import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';
import type { FishingActivityTaskOptions } from '@/lib/types/minions.js';

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
			description: 'Powerfish for faster XP without banking loot.',
			required: false
		},
		{
			type: 'Boolean',
			name: 'spirit_flakes',
			description: 'Use spirit flakes for a chance at extra fish.',
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
		const spot = Fishing.Fishes.find(
			fish =>
				stringSearch(fish.name, options.name) || fish.alias?.some(alias => stringSearch(alias, options.name))
		);
		if (!spot) return 'Thats not a valid spot you can fish at.';

		const requiredLevel = spot.subfishes?.[0]?.level ?? spot.level ?? 1;
		if (user.skillsAsLevels.fishing < requiredLevel) {
			return `${user.minionName} needs ${requiredLevel} Fishing to fish ${spot.name}.`;
		}

		if (spot.qpRequired && user.QP < spot.qpRequired) {
			return `You need ${spot.qpRequired} qp to catch those!`;
		}

		if (
			spot.name === 'Barbarian fishing' &&
			(user.skillsAsLevels.agility < 15 || user.skillsAsLevels.strength < 15)
		) {
			return 'You need at least 15 Agility and Strength to do Barbarian Fishing.';
		}

		if (spot.name === 'Infernal eel') {
			const jadKC = await user.getKC(Monsters.TzTokJad.id);
			if (jadKC === 0) {
				return 'You are not worthy JalYt. Before you can fish Infernal Eels, you need to have defeated the mighty TzTok-Jad!';
			}
		}

		if (spot.name === 'Minnow' && ItemGroups.anglerOutfit.some(_piece => !user.hasEquippedOrInBank(_piece))) {
			return 'You need to own the Angler Outfit to fish for Minnows.';
		}

		const maxTripLength = user.calcMaxTripLength('Fishing');
		const [hasWildyEliteDiary] = await userhasDiaryTier(user, WildernessDiary.elite);

		const res = Fishing.util.calcFishingTripStart({
			gearBank: user.gearBank,
			fish: spot,
			maxTripLength,
			quantityInput: options.quantity,
			wantsToUseFlakes: Boolean(options.spirit_flakes),
			powerfishing: Boolean(options.powerfish),
			hasWildyEliteDiary
		});
		if (typeof res === 'string') {
			return res;
		}

		if (res.cost.length > 0) {
			if (!user.owns(res.cost)) {
				return `You don't own the required items to fish ${spot.name}, you need: ${res.cost}.`;
			}
			await user.transactItems({
				itemsToRemove: res.cost
			});
		}

		await ActivityManager.startTrip<FishingActivityTaskOptions>({
			fishID: spot.name,
			userID: user.id,
			channelID,
			quantity: res.quantity,
			iQty: options.quantity ? options.quantity : undefined,
			duration: res.duration,
			type: 'Fishing',
			catches: res.catches,
			loot: res.loot,
			flakesToRemove: res.flakesToRemove,
			powerfishing: res.powerfishing,
			spiritFlakes: res.spiritFlakes
		});

		const { powerfishing, spiritFlakes } = res;
		let response = `${user.minionName} is now fishing ${res.quantity.toLocaleString()}x ${spot.name}, it'll take around ${formatDuration(
			res.duration
		)} to finish.`;

		if (powerfishing) {
			response += '\nThey will drop the fish for the best possible XP rates.';
		}

		if (spiritFlakes && res.flakesBeingUsed) {
			response += `\nUsing ${res.flakesBeingUsed.toLocaleString()} spirit flakes.`;
		}

		if (res.boosts.length > 0) {
			response += `\n\n**Boosts:** ${res.boosts.join(', ')}.`;
		}

		return response;
	}
};
