import { formatDuration, stringMatches, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import Firemaking from '@/lib/skilling/skills/firemaking.js';
import { TripError } from '@/lib/structures/TripError.js';
import type { FiremakingActivityTaskOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

export const lightCommand = defineCommand({
	name: 'light',
	description: 'Light logs to train Firemaking.',
	attributes: {
		requiresMinion: true,
		requiresMinionNotBusy: true,
		examples: ['/light name:Logs']
	},
	options: [
		{
			type: 'String',
			name: 'name',
			description: 'The logs you want to burn.',
			required: true,
			autocomplete: async ({ value }: StringAutoComplete) => {
				return Firemaking.Burnables.filter(i =>
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
			description: 'The quantity you want to burn (optional).',
			required: false,
			min_value: 1
		}
	],
	run: async ({ options, user, channelId }) => {
		const log = Firemaking.Burnables.find(
			log => stringMatches(log.name, options.name) || stringMatches(log.name.split(' ')[0], options.name)
		);

		if (!log) throw new TripError("That's not a valid log to light.", [user.id]);

		if (user.skillsAsLevels.firemaking < log.level) {
			throw new TripError(`${user.minionName} needs ${log.level} Firemaking to light ${log.name}.`, [user.id]);
		}

		// All logs take 2.4s to light, add on quarter of a second to account for banking/etc.
		const timeToLightSingleLog = Time.Second * 2.4 + Time.Second / 4;

		const maxTripLength = await user.calcMaxTripLength('Firemaking');

		const amountOfLogsOwned = user.bank.amount(log.inputLogs);

		let { quantity } = options;
		// If no quantity provided, set it to the max.
		if (!quantity) {
			if (!amountOfLogsOwned) throw new TripError(`You have no ${log.name}.`, [user.id]);
			quantity = Math.min(Math.floor(maxTripLength / timeToLightSingleLog), amountOfLogsOwned);
		}
		const duration = quantity * timeToLightSingleLog;

		const cost = new Bank().add(log.inputLogs, quantity);
		if (!user.owns(cost)) throw new TripError(`You dont have ${quantity}x ${log.name}.`, [user.id]);

		if (duration > maxTripLength) {
			throw new TripError(
				`${user.minionName} can't go on trips longer than ${formatDuration(
					maxTripLength
				)}, try a lower quantity. The highest amount of ${log.name}s you can light is ${Math.floor(
					maxTripLength / timeToLightSingleLog
				)}.`,
				[user.id]
			);
		}

		await user.transactItems({ itemsToRemove: cost });

		await ActivityManager.startTrip<FiremakingActivityTaskOptions>({
			burnableID: log.inputLogs,
			userID: user.id,
			channelId,
			quantity,
			duration,
			type: 'Firemaking'
		});

		return `${user.minionName} is now lighting ${quantity}x ${log.name}, it'll take around ${formatTripDuration(
			user,
			duration
		)} to finish.`;
	}
});
