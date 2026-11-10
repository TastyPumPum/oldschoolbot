import { formatDuration, reduceNumByPercent, sumArr, Time } from '@oldschoolgg/toolkit';
import type { Bank } from 'oldschooljs';

import { sepulchreBoosts, sepulchreFloors } from '@/lib/minions/data/sepulchre.js';
import Arrows from '@/lib/skilling/skills/fletching/fletchables/arrows.js';
import Bolts from '@/lib/skilling/skills/fletching/fletchables/bolts.js';
import Darts from '@/lib/skilling/skills/fletching/fletchables/darts.js';
import { zeroTimeFletchables } from '@/lib/skilling/skills/fletching/fletchables/index.js';
import Javelins from '@/lib/skilling/skills/fletching/fletchables/javelins.js';
import { AmethystBroadBolts, BroadArrows, BroadBolts } from '@/lib/skilling/skills/fletching/fletchables/slayer.js';
import TippedBolts from '@/lib/skilling/skills/fletching/fletchables/tippedBolts.js';
import TippedDragonBolts from '@/lib/skilling/skills/fletching/fletchables/tippedDragonBolts.js';
import type { Fletchable } from '@/lib/skilling/types.js';
import { TripError } from '@/lib/structures/TripError.js';
import type { SepulchreActivityTaskOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

export async function sepulchreCommand(user: MUser, channelId: string, fletching?: number) {
	const skills = user.skillsAsLevels;
	const agilityLevel = skills.agility;
	const thievingLevel = skills.thieving;

	if (agilityLevel < sepulchreFloors[0].agilityLevel) {
		throw new TripError(
			`You need at least level ${sepulchreFloors[0].agilityLevel} Agility to do the Hallowed Sepulchre.`,
			[user.id]
		);
	}
	if (thievingLevel < 66) {
		throw new TripError('You need at least level 66 Thieving to do the Hallowed Sepulchre.', [user.id]);
	}
	if (!user.hasGracefulEquipped()) {
		throw new TripError('You need Graceful equipped in any setup to do the Hallowed Sepulchre.', [user.id]);
	}

	// Base data
	const completableFloors = sepulchreFloors.filter(f => agilityLevel >= f.agilityLevel);
	let lapLength = sumArr(completableFloors.map(f => f.time));

	// Boosts
	const percentReduced = Math.min(
		Math.floor((await user.fetchMinigameScore('sepulchre')) / (Time.Hour / lapLength)),
		10
	);
	lapLength = reduceNumByPercent(lapLength, percentReduced);
	const boosts = [`${percentReduced.toFixed(1)}% for minion learning`];

	for (const [item, percent] of sepulchreBoosts.items()) {
		if (user.hasEquippedOrInBank(item.id)) {
			boosts.push(`${percent}% for ${item.name}`);
			lapLength = reduceNumByPercent(lapLength, percent);
		}
	}

	const maxLaps = Math.floor((await user.calcMaxTripLength('Sepulchre')) / lapLength);
	const tripLength = maxLaps * lapLength;

	let fletchable: Fletchable | undefined;

	let fletchingQuantity = 0;
	let sets = '';
	let itemsNeeded: Bank | undefined;
	let timeToFletchSingleItem = 0;

	if (fletching) {
		fletchable = zeroTimeFletchables.find(item => item.id === Number(fletching));
		if (!fletchable) throw new TripError('That is not a valid item to fletch during Sepulchre.', [user.id]);

		if (user.skillLevel('fletching') < fletchable.level) {
			throw new TripError(
				`${user.minionName} needs ${fletchable.level} Fletching to fletch ${fletchable.name}.`,
				[user.id]
			);
		}

		if (fletchable.requiredSlayerUnlocks) {
			const { success, errors } = user.checkHasSlayerUnlocks(fletchable.requiredSlayerUnlocks);
			if (!success) {
				throw new TripError(
					`You don't have the required Slayer Unlocks to create this item.\n\nRequired: ${errors}`,
					[user.id]
				);
			}
		}

		// Determine fletching speed
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
		if (timeToFletchSingleItem === 0) throw new TripError('Error selecting fletchable.', [user.id]);

		fletchingQuantity = Math.floor(tripLength / timeToFletchSingleItem);
		if (fletchable.outputMultiple) sets = ' sets of';

		const max = user.bank.fits(fletchable.inputItems);
		if (max < fletchingQuantity && max !== 0) fletchingQuantity = max;

		itemsNeeded = fletchable.inputItems.clone().multiply(fletchingQuantity);
		if (!user.bankWithGP.has(itemsNeeded)) {
			throw new TripError(
				`You don't have enough items. For ${fletchingQuantity}x ${fletchable.name}, you're missing **${itemsNeeded
					.clone()
					.remove(user.bank)}**.`,
				[user.id]
			);
		}

		await user.removeItemsFromBank(itemsNeeded);
	}

	await ActivityManager.startTrip<SepulchreActivityTaskOptions>({
		floors: completableFloors.map(f => f.number),
		quantity: maxLaps,
		userID: user.id,
		duration: tripLength,
		type: 'Sepulchre',
		channelId,
		minigameID: 'sepulchre',
		fletch: fletchable ? { id: fletchable.id, qty: fletchingQuantity } : undefined
	});

	let str = `${user.minionName} is now doing ${maxLaps} laps of the Sepulchre, in each lap they are doing floors ${
		completableFloors[0].number
	}-${completableFloors[completableFloors.length - 1].number}, the trip will return in about ${formatTripDuration(user, tripLength)}, with each lap taking ${formatDuration(lapLength)}.`;

	if (fletchable && itemsNeeded) {
		str += `\nYou are also now Fletching ${fletchingQuantity}${sets} ${fletchable.name}. Removed ${itemsNeeded} from your bank.`;
	}

	if (boosts.length > 0) {
		str += `\n\n**Boosts:** ${boosts.join(', ')}.`;
	}

	return str;
}
