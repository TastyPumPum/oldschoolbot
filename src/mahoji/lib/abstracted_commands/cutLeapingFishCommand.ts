import { formatDuration, stringMatches, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { LeapingFish } from '@/lib/skilling/skills/cooking/leapingFish.js';
import { TripError } from '@/lib/structures/TripError.js';
import type { CutLeapingFishActivityTaskOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

export async function cutLeapingFishCommand({
	user,
	channelId,
	name,
	quantity
}: {
	user: MUser;
	channelId: string;
	name: string;
	quantity?: number;
}) {
	const barbarianFish = LeapingFish.find(
		_leapingFish =>
			stringMatches(_leapingFish.item.name, name) ||
			stringMatches(_leapingFish.item.name.split(' ')[0], name) ||
			_leapingFish.aliases.some(alias => stringMatches(alias, name))
	);

	if (!barbarianFish) throw new TripError('That is not a valid fish to cut.', [user.id]);

	const requiredItems = barbarianFish.item.name;

	const timeToCutSingleItem = barbarianFish.tickRate * Time.Second * 0.6;

	const maxTripLength = await user.calcMaxTripLength('Cooking');

	if (!quantity) quantity = Math.floor(maxTripLength / timeToCutSingleItem);

	const baseCost = new Bank().add(requiredItems);

	const maxCanDo = user.bank.fits(baseCost);
	if (maxCanDo === 0) {
		throw new TripError(
			`You don't have enough supplies to cut even one of this item!\nTo cut a ${barbarianFish.item.name}, you need to have ${baseCost}.`,
			[user.id]
		);
	}
	if (maxCanDo < quantity) {
		quantity = maxCanDo;
	}

	const duration = quantity * timeToCutSingleItem;

	if (duration > maxTripLength) {
		throw new TripError(
			`${user.minionName} can't go on trips longer than ${formatDuration(
				maxTripLength
			)}, try a lower quantity. The highest amount of ${barbarianFish.item.name}'s you can cut is ${Math.floor(
				maxTripLength / timeToCutSingleItem
			)}.`,
			[user.id]
		);
	}

	const finalCost = new Bank();
	finalCost.add(baseCost.multiply(quantity));

	if (!user.owns(finalCost)) {
		throw new TripError(`You don't own: ${finalCost}.`, [user.id]);
	}
	await user.removeItemsFromBank(finalCost);

	await ActivityManager.startTrip<CutLeapingFishActivityTaskOptions>({
		fishID: barbarianFish.item.id,
		userID: user.id,
		channelId,
		quantity,
		duration,
		type: 'CutLeapingFish'
	});

	return `${user.minionName} is now cutting ${quantity}x ${
		barbarianFish.item.name
	}, it'll take around ${formatTripDuration(user, duration)} to finish.`;
}
