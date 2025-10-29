import { formatDuration, getNextUTCReset, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { getBertSandRequirementError, isBertSandReady } from '@/lib/minions/data/bertSand.js';
import type { CollectingOptions } from '@/lib/types/minions.js';
import { collectables } from '@/mahoji/lib/collectables.js';

export const collectingTask: MinionTask = {
	type: 'Collecting',
	async run(data: CollectingOptions, { user, handleTripFinish }) {
		const { collectableID, quantity, channelID, duration, lootQuantityOverride, bertSand } = data;

		const collectable = collectables.find(c => c.item.id === collectableID)!;
		let colQuantity = collectable.quantity;

		const hasMoryHard = user.hasDiary('morytania.hard');
		const moryHardBoost = collectable.item.name === 'Mort myre fungus' && hasMoryHard;
		if (moryHardBoost) {
			colQuantity *= 2;
		}
		let totalQuantity = quantity * colQuantity;
		if (typeof lootQuantityOverride === 'number') {
			totalQuantity = lootQuantityOverride;
		}
		const loot = new Bank().add(collectable.item.id, totalQuantity);

		if (bertSand) {
			const requirementError = getBertSandRequirementError(user);
			if (requirementError) {
				handleTripFinish(user, channelID, `${user}, ${requirementError}`, undefined, data);
				return;
			}

			const now = Date.now();
			const refreshedStats = await user.fetchStats();
			const refreshedLastCollected = Number(refreshedStats.last_bert_sand_timestamp ?? 0n);

			if (refreshedLastCollected > bertSand.lastCollectedAtStart) {
				const nextReset = getNextUTCReset(refreshedLastCollected, Time.Day);
				handleTripFinish(
					user,
					channelID,
					`${user}, Bert already delivered your buckets of sand. You can collect again in ${formatDuration(
						nextReset - now
					)}.`,
					undefined,
					data
				);
				return;
			}

			if (!isBertSandReady(refreshedLastCollected, now)) {
				const nextReset = getNextUTCReset(refreshedLastCollected, Time.Day);
				handleTripFinish(
					user,
					channelID,
					`${user}, Bert will have more buckets of sand for you in ${formatDuration(nextReset - now)}.`,
					undefined,
					data
				);
				return;
			}

			await user.addItemsToBank({
				items: loot,
				collectionLog: false
			});

			await user.statsUpdate({ last_bert_sand_timestamp: now });
			await ClientSettings.updateBankSetting('collecting_loot', loot);

			const perHour = Math.round((totalQuantity / (duration / Time.Minute)) * 60).toLocaleString();
			const str = `${user}, ${user.minionName} finished collecting ${totalQuantity.toLocaleString()}x ${
				collectable.item.name
			} from Bert. (${perHour}/hr)`;
			handleTripFinish(user, channelID, str, undefined, data, loot);
			return;
		}

		await user.transactItems({
			collectionLog: true,
			itemsToAdd: loot
		});

		let str = `${user}, ${user.minionName} finished collecting ${totalQuantity}x ${
			collectable.item.name
		}. (${Math.round((totalQuantity / (duration / Time.Minute)) * 60).toLocaleString()}/hr)`;
		if (moryHardBoost) {
			str += '\n\n**Boosts:** 2x for Morytania Hard diary';
		}

		await ClientSettings.updateBankSetting('collecting_loot', loot);

		handleTripFinish(user, channelID, str, undefined, data, loot ?? null);
	}
};
