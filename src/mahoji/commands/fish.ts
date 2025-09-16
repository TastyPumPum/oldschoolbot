import { type CommandRunOptions, formatDuration, stringSearch } from '@oldschoolgg/toolkit/util';
import { ApplicationCommandOptionType } from 'discord.js';
import { ItemGroups, Monsters } from 'oldschooljs';

import type { BarbloreActivityTaskOptions, FishingActivityTaskOptions } from '@/lib/types/minions';
import addSubTaskToActivityTask from '@/lib/util/addSubTaskToActivityTask';
import { calcMaxTripLength } from '@/lib/util/calcMaxTripLength';
import type { OSBMahojiCommand } from '@oldschoolgg/toolkit/discord-util';
import { Fishing } from '../../lib/skilling/skills/fishing/fishing';
import { calcBarbloreTripStart, ensureBarbloreActivityType } from '../../lib/skilling/skills/fishing/barbloreTripStart';

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
			type: ApplicationCommandOptionType.String,
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
			type: ApplicationCommandOptionType.Integer,
			name: 'quantity',
			description: 'The quantity you want to fish (optional).',
			required: false,
			min_value: 1
		},
		{
			type: ApplicationCommandOptionType.Boolean,
			name: 'flakes',
			description: 'Use spirit flakes?',
			required: false
                },
                {
                        type: ApplicationCommandOptionType.Boolean,
                        name: 'barblore',
                        description: 'Combine Barbarian fishing with Barbarian mixes for extra XP.',
                        required: false
                }
        ],
        run: async ({
                options,
                userID,
                channelID
        }: CommandRunOptions<{ name: string; quantity?: number; flakes?: boolean; barblore?: boolean }>) => {
                const fish = Fishing.Fishes.find(fish => stringSearch(fish.name, options.name));
                if (!fish) return 'Thats not a valid fish to catch.';

                const user = await mUserFetch(userID);
                if (user.skillsAsLevels.fishing < fish.level) {
			return `${user.minionName} needs ${fish.level} Fishing to fish ${fish.name}.`;
		}

		if (fish.qpRequired && user.QP < fish.qpRequired) {
			return `You need ${fish.qpRequired} qp to catch those!`;
		}

		if (
			fish.name === 'Barbarian fishing' &&
			(user.skillsAsLevels.agility < 15 || user.skillsAsLevels.strength < 15)
		) {
			return 'You need at least 15 Agility and Strength to do Barbarian Fishing.';
		}

		if (fish.name === 'Infernal eel') {
			const jadKC = await user.getKC(Monsters.TzTokJad.id);
			if (jadKC === 0) {
				return 'You are not worthy JalYt. Before you can fish Infernal Eels, you need to have defeated the mighty TzTok-Jad!';
			}
		}

		if (fish.name === 'Minnow' && ItemGroups.anglerOutfit.some(_piece => !user.hasEquippedOrInBank(_piece))) {
			return 'You need to own the Angler Outfit to fish for Minnows.';
		}

                const maxTripLength = calcMaxTripLength(user, 'Fishing');

                if (options.barblore) {
                        if (fish.name !== 'Barbarian fishing') {
                                return 'The Barblore method can only be used while Barbarian fishing.';
                        }

                        const res = calcBarbloreTripStart({
                                gearBank: user.gearBank,
                                fish,
                                maxTripLength,
                                quantityInput: options.quantity,
                                wantsToUseFlakes: Boolean(options.flakes)
                        });
                        if (typeof res === 'string') {
                                return res;
                        }

                        if (!user.owns(res.cost)) {
                                return `You don't own the required items to fish ${fish.name}, you need: ${res.cost}.`;
                        }

                        await user.transactItems({
                                itemsToRemove: res.cost
                        });

                        await ensureBarbloreActivityType();

                        await addSubTaskToActivityTask<BarbloreActivityTaskOptions>({
                                type: 'BarbloreFishing' as any,
                                fishID: fish.id,
                                userID: user.id,
                                channelID,
                                quantity: res.quantity,
                                duration: res.duration,
                                iQty: res.originalQuantity,
                                xp: res.xp,
                                xpPerHour: res.xpPerHour,
                                mixPlan: res.mixPlan.map(plan => ({
                                        ingredient: plan.ingredient,
                                        mixID: plan.mix.item.id,
                                        mixName: plan.mix.item.name,
                                        potionID: plan.potionID,
                                        potionName: plan.potionName,
                                        quantity: plan.quantity,
                                        xpPerMix: plan.mix.xp
                                })),
                                leftoverFish: res.leftoverFish,
                                leftoverIngredients: res.leftoverIngredients,
                                ingredientsUsed: res.ingredientsUsed,
                                fishOffcuts: res.fishOffcuts,
                                boosts: res.boosts
                        });

                        let response = `${user.minionName} is now performing Barblore with ${res.quantity}x ${fish.name}, it'll take around ${formatDuration(
                                res.duration
                        )} to finish.`;

                        if (res.boosts.length > 0) {
                                response += `\n\n**Boosts:** ${res.boosts.join(', ')}.`;
                        }

                        return response;
                }

                const res = Fishing.util.calcFishingTripStart({
                        gearBank: user.gearBank,
                        fish,
                        maxTripLength,
                        quantityInput: options.quantity,
                        wantsToUseFlakes: Boolean(options.flakes)
                });
                if (typeof res === 'string') {
                        return res;
                }

                if (res.cost.length > 0) {
                        if (!user.owns(res.cost)) {
                                return `You don't own the required items to fish ${fish.name}, you need: ${res.cost}.`;
                        }
                        await user.transactItems({
                                itemsToRemove: res.cost
                        });
                }

                await addSubTaskToActivityTask<FishingActivityTaskOptions>({
                        fishID: fish.id,
                        userID: user.id,
                        channelID,
                        quantity: res.quantity,
                        iQty: options.quantity ? options.quantity : undefined,
                        duration: res.duration,
                        type: 'Fishing',
                        flakesQuantity: res.flakesBeingUsed
                });

                let response = `${user.minionName} is now fishing ${res.quantity}x ${fish.name}, it'll take around ${formatDuration(
                        res.duration
                )} to finish.`;

                if (res.boosts.length > 0) {
                        response += `\n\n**Boosts:** ${res.boosts.join(', ')}.`;
                }

                return response;
        }
};
