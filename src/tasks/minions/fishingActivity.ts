import { Emoji, Events } from '@oldschoolgg/toolkit';
import { EItem } from 'oldschooljs';

import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';
import type { FishingActivityTaskOptions } from '@/lib/types/minions.js';

export const fishingTask: MinionTask = {
	type: 'Fishing',
	async run(data: FishingActivityTaskOptions, { handleTripFinish, user, rng }) {
		const {
			fishID,
			channelID,
			Qty,
			loot = [],
			blessingExtra = 0,
			flakeExtra = 0,
			usedBarbarianCutEat = false
		} = data;

		const fish = Fishing.Fishes.find(f => f.name === fishID);
		if (!fish || !fish.subfishes) {
			throw new Error(`Invalid fishing spot received: ${fishID}`);
		}

		const result = Fishing.util.calcFishingTripResult({
			fish,
			duration: data.duration,
			catches: Qty,
			loot,
			gearBank: user.gearBank,
			blessingExtra,
			flakeExtra,
			rng,
			usedBarbarianCutEat
		});

		const updateResult = await result.updateBank.transact(user);
		if (typeof updateResult === 'string') {
			throw new Error(`Fishing trip update bank failed: ${updateResult}`);
		}

		const { itemTransactionResult, message: xpMessage } = updateResult;

		let message = `${user}, ${user.minionName} finished fishing ${result.totalCatches} ${fish.name}. `;

		const bonusXpEntries = Object.entries(result.bonusXpPerHour ?? {}).filter(([, value]) => value);
		const perHourSegments = [`${result.xpPerHour}/Hr`];
		if (bonusXpEntries.length > 0) {
			for (const [skill, value] of bonusXpEntries) {
				const formattedSkill = `${skill.charAt(0).toUpperCase()}${skill.slice(1)}`;
				perHourSegments.push(`${value}/Hr ${formattedSkill}`);
			}
		}
		message += `You received ${result.updateBank.xpBank} (${perHourSegments.join(', ')}).`;

		if (xpMessage) {
			const congratsLines = xpMessage
				.split('\n')
				.map(line => line.trim())
				.filter(line => line.startsWith('**Congratulations'));
			if (congratsLines.length > 0) {
				message += `\n${congratsLines.join('\n')}`;
			}
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
