import { MathRNG } from '@oldschoolgg/rng';
import { Emoji, Events } from '@oldschoolgg/toolkit';
import { EItem, Items } from 'oldschooljs';

import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';
import type { FishingActivityTaskOptions } from '@/lib/types/minions.js';

export const fishingTask: MinionTask = {
	type: 'Fishing',
	async run(data: FishingActivityTaskOptions, { handleTripFinish, user }) {
		const { fishID, channelID, catches, loot, powerfishing } = data;
		const fish = Fishing.Fishes.find(f => f.name === fishID)!;

		const result = Fishing.util.calcFishingTripResult({
			fish,
			catches,
			loot,
			duration: data.duration,
			gearBank: user.gearBank,
			rng: MathRNG,
			flakesToRemove: data.flakesToRemove,
			powerfishing: Boolean(powerfishing)
		});

		const resultOrError = await result.updateBank.transact(user);
		if (typeof resultOrError === 'string') {
			const err = new Error(`Fishing trip update bank failed: ${resultOrError}`);
			Logging.logError(err, {
				userID: user.id,
				fishID,
				quantity: result.totalCatches
			});
			return;
		}
		const { itemTransactionResult, rawResults } = resultOrError;

		const lootSummary: string[] = [];
		if (fish.subfishes) {
			fish.subfishes.forEach((subfish, index) => {
				const qty = powerfishing ? catches[index] : loot[index];
				if (!qty) return;
				const itemName = Items.get(subfish.id)?.name ?? fish.name;
				lootSummary.push(`${qty.toLocaleString()}x ${itemName}`);
			});
		} else {
			const qty = powerfishing ? result.totalCatches : loot[0];
			if (qty && fish.id) {
				lootSummary.push(`${qty.toLocaleString()}x ${Items.get(fish.id)!.name}`);
			}
		}

		let str = `${user}, ${user.minionName} finished ${powerfishing ? 'powerfishing' : 'fishing'} ${fish.name}. ${rawResults.join(', ')}`;

		if (!powerfishing && lootSummary.length > 0) {
			str += `\nThey brought back ${lootSummary.join(', ')}.`;
		}

		if (result.boosts.length > 0) {
			str += `\n\n**Boosts:** ${result.boosts.join(', ')}`;
		}

		if (itemTransactionResult?.itemsAdded.has(EItem.HERON)) {
			globalClient.emit(
				Events.ServerNotification,
				`${Emoji.Fishing} **${user.badgedUsername}'s** minion, ${user.minionName}, just received a Heron while fishing ${fish.name} at level ${user.skillsAsLevels.fishing} Fishing!`
			);
		}

		handleTripFinish(user, channelID, str, undefined, data, itemTransactionResult?.itemsAdded ?? null);
	}
};
