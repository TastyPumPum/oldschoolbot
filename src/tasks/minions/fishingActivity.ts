import { Emoji, Events } from '@oldschoolgg/toolkit';
import { EItem } from 'oldschooljs';

import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';
import type { FishingActivityTaskOptions } from '@/lib/types/minions.js';

export const fishingTask: MinionTask = {
	type: 'Fishing',
	async run(data: FishingActivityTaskOptions, { handleTripFinish, user }) {
		const { fishID, channelID, Qty, loot = [], flakesToRemove } = data;

		const fish = Fishing.Fishes.find(f => f.name === fishID);
		if (!fish || !fish.subfishes) {
			throw new Error(`Invalid fishing spot received: ${fishID}`);
		}

		const result = Fishing.util.calcFishingTripResult({
			fish,
			duration: data.duration,
			catches: Qty,
			loot,
			flakesBeingUsed: flakesToRemove,
			gearBank: user.gearBank
		});

		const updateResult = await result.updateBank.transact(user);
		if (typeof updateResult === 'string') {
			throw new Error(`Fishing trip update bank failed: ${updateResult}`);
		}

		const { itemTransactionResult } = updateResult;

		let message = `${user}, ${user.minionName} finished fishing ${result.totalCatches} ${fish.name}. `;

		if (result.otherXpPerHour !== '0') {
			message += `You received ${result.updateBank.xpBank} (${result.xpPerHour}/Hr and ${result.otherXpPerHour}/Hr).`;
		} else {
			message += `You received ${result.updateBank.xpBank} (${result.xpPerHour}/Hr).`;
		}

		if (itemTransactionResult?.itemsAdded.length) {
			message += `\nYou received ${itemTransactionResult.itemsAdded}.`;
		}

		if (result.messages.length > 0) {
			message += `\n${result.messages.join(', ')}.`;
		}

		if (itemTransactionResult?.itemsAdded.has(EItem.HERON)) {
			globalClient.emit(
				Events.ServerNotification,
				`${Emoji.Fishing} **${user.badgedUsername}'s** minion, ${user.minionName}, just received a Heron while fishing ${fish.name} at level ${user.skillsAsLevels.fishing} Fishing!`
			);
		}

		handleTripFinish(user, channelID, message, undefined, data, result.updateBank.itemLootBank);
	}
};
