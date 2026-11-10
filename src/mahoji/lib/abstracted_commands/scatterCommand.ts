import { formatDuration, stringMatches, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import Prayer from '@/lib/skilling/skills/prayer.js';
import { TripError } from '@/lib/structures/TripError.js';
import type { ScatteringActivityTaskOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

export async function scatterCommand(user: MUser, channelId: string, ashName: string, quantity?: number) {
	const speedMod = 1;

	const ash = Prayer.Ashes.find(
		ash => stringMatches(ash.name, ashName) || stringMatches(ash.name.split(' ')[0], ashName)
	);

	if (!ash) {
		throw new TripError("That's not a valid ash to scatter.", [user.id]);
	}

	if (user.skillsAsLevels.prayer < ash.level) {
		throw new TripError(`${user.minionName} needs ${ash.level} Prayer to scatter ${ash.name}.`, [user.id]);
	}

	const timeToScatterAnAsh = speedMod * (Time.Second * 1.2 + Time.Second / 4);

	const maxTripLength = await user.calcMaxTripLength('Scattering');

	if (!quantity) {
		const amountOfAshesOwned = user.bank.amount(ash.inputId);
		if (!amountOfAshesOwned) throw new TripError(`You have no ${ash.name}.`, [user.id]);
		quantity = Math.min(Math.floor(maxTripLength / timeToScatterAnAsh), amountOfAshesOwned);
	}

	const cost = new Bank({ [ash.inputId]: quantity });

	if (!user.owns(cost)) {
		throw new TripError(`You dont have ${cost}.`, [user.id]);
	}

	const duration = quantity * timeToScatterAnAsh;

	if (duration > maxTripLength) {
		throw new TripError(
			`${user.minionName} can't go on trips longer than ${formatDuration(
				maxTripLength
			)}, try a lower quantity. The highest amount of ${ash.name}s you can scatter is ${Math.floor(
				maxTripLength / timeToScatterAnAsh
			)}.`,
			[user.id]
		);
	}

	await user.transactItems({ itemsToRemove: cost });

	await ActivityManager.startTrip<ScatteringActivityTaskOptions>({
		ashID: ash.inputId,
		userID: user.id,
		channelId,
		quantity,
		duration,
		type: 'Scattering'
	});

	return `${user.minionName} is now scattering ${cost}, it'll take around ${formatTripDuration(user, duration)} to finish.`;
}
