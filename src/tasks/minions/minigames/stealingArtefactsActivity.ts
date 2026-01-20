import { randInt } from '@oldschoolgg/rng';
import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { calculateStealingArtefactsXpPerHour, getGlassblowingProduct } from '@/lib/minions/data/stealingArtefacts.js';
import type { StealingArtefactsActivityTaskOptions } from '@/lib/types/minions.js';

export const stealingArtefactsTask: MinionTask = {
	type: 'StealingArtefacts',
	async run(data: StealingArtefactsActivityTaskOptions, { user, handleTripFinish }) {
		const { channelId, duration, stamina, teleportEligible, glassblow } = data;
		const thievingLevel = user.skillsAsLevels.thieving;
		const hasGraceful = user.hasGracefulEquipped();

		const hours = duration / Time.Hour;
		const xpInfo = calculateStealingArtefactsXpPerHour({
			thievingLevel,
			teleportEligible,
			hasGraceful,
			stamina
		});

		const deliveries = Math.floor(xpInfo.deliveriesPerHour * hours);
		const thievingXp = Math.floor(xpInfo.finalXpPerHour * hours);

		let coinsGained = 0;
		for (let i = 0; i < deliveries; i++) {
			coinsGained += randInt(500, 1000);
		}

		if (deliveries > 0) {
			await user.incrementMinigameScore('stealing_artefacts', deliveries);
		}

		const loot = new Bank();
		if (coinsGained > 0) {
			loot.add('Coins', coinsGained);
			await ClientSettings.updateClientGPTrackSetting('gp_pickpocket', coinsGained);
		}

		let craftingXp = 0;
		if (glassblow) {
			const product = getGlassblowingProduct(glassblow.product);
			if (product) {
				loot.add(product.item.id, glassblow.itemsMade);
				craftingXp = glassblow.itemsMade * product.xp;
			}
		}

		const { previousCL, itemsAdded } = await user.transactItems({
			collectionLog: true,
			itemsToAdd: loot
		});

		const thievingXpMessage = await user.addXP({ skillName: 'thieving', amount: thievingXp, duration });
		const craftingXpMessage =
			glassblow && craftingXp > 0
				? await user.addXP({ skillName: 'crafting', amount: craftingXp, duration })
				: null;

		const capType = teleportEligible ? 'Teleport' : 'Base';
		const boosts = [
			hasGraceful ? 'Graceful equipped (+20%)' : null,
			stamina ? 'Stamina selected (+30%)' : null,
			teleportEligible ? 'Teleport efficiency active' : null
		].filter(Boolean);

		const finalXpPerHour = Number.isInteger(xpInfo.finalXpPerHour)
			? xpInfo.finalXpPerHour.toLocaleString()
			: xpInfo.finalXpPerHour.toFixed(1);

		let message = `${user}, ${user.minionName} finished stealing artefacts.\n`;
		message += `**Duration:** ${formatDuration(duration)}\n`;
		message += `**Thieving level:** ${thievingLevel}\n`;
		message += `**Thieving XP gained:** ${thievingXp.toLocaleString()} (${finalXpPerHour} XP/hr, ${capType} cap)\n`;
		if (boosts.length > 0) {
			message += `**Boosts active:** ${boosts.join(', ')}\n`;
		}
		message += `**Deliveries:** ${deliveries.toLocaleString()}\n`;
		message += `**Coins gained:** ${coinsGained.toLocaleString()}\n`;

		if (glassblow && craftingXp > 0) {
			const product = getGlassblowingProduct(glassblow.product);
			if (product) {
				message += `**Crafting XP gained:** ${Math.floor(craftingXp).toLocaleString()}\n`;
				message += `**Glassblown:** ${glassblow.itemsMade.toLocaleString()}x ${product.item.name}\n`;
				message += `**Molten glass used:** ${glassblow.moltenGlassUsed.toLocaleString()}\n`;
			}
		}

		message += thievingXpMessage;
		if (craftingXpMessage) {
			message += `\n${craftingXpMessage}`;
		}

		const embed = new MessageBuilder().setContent(message);
		if (itemsAdded.length > 0) {
			embed.addBankImage({
				bank: itemsAdded,
				title: 'Loot from Stealing artefacts',
				user,
				previousCL
			});
		}

		handleTripFinish({ user, channelId, message: embed, data, loot: itemsAdded });
	}
};
