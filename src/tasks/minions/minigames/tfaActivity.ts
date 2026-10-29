import { Emoji, Events, formatOrdinal } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { trackLoot } from '@/lib/lootTrack.js';
import { resolveAttackStyles } from '@/lib/minions/functions/index.js';
import { TeamLoot } from '@/lib/simulation/TeamLoot.js';
import {
	rollTFALoot,
	TFA_BALANCING,
	TFABosses,
	TFAFragments,
	TFALivingRecords,
	TFAUniques,
	tfaDeathFee,
	tfaQuartermasterRefund
} from '@/lib/simulation/tfa.js';
import { XPCounter } from '@/lib/structures/XPCounter.js';
import type { FracturedArchiveTaskOptions } from '@/lib/types/minions.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';
import { autoRepeatTFATrip } from '@/mahoji/lib/abstracted_commands/tfaCommand.js';

export const tfaTask: MinionTask = {
	type: 'FracturedArchive',
	async run(data: FracturedArchiveTaskOptions, { handleTripFinish, user: leader, rng }) {
		const { channelId, users, raids, duration, deathFeeReserved } = data;
		const allUsers = await Promise.all(users.map(id => mUserFetch(id)));
		const startingKCs = await Promise.all(allUsers.map(user => user.fetchMinigameScore('fractured_archive')));
		const teamLoot = new TeamLoot(TFAUniques);
		const fragmentLogs = new Map(
			allUsers.map(user => [user.id, user.cl.filter(item => TFAFragments.includes(item.id))])
		);
		if (data.fakeMass) {
			for (const member of raids[0].members) {
				if (member.id !== data.leader) fragmentLogs.set(member.id, fragmentLogs.get(data.leader)!.clone());
			}
		}
		const simulatedLoot = new Map<string, Bank>();
		const deathFees = new Map(users.map(id => [id, 0]));
		const deathCounts = new Map(users.map(id => [id, 0]));
		const xpCounters = new Map(users.map(id => [id, new XPCounter()]));
		const results: string[] = [];
		let completions = 0;
		for (const [index, raid] of raids.entries()) {
			const { loot, uniqueChance } = rollTFALoot(raid, rng, fragmentLogs);
			for (const [id, bank] of loot) {
				fragmentLogs.get(id)?.add(bank.filter(item => TFAFragments.includes(item.id)));
			}
			if (data.fakeMass) {
				for (const member of raid.members) {
					if (member.id === data.leader) continue;
					const bank = simulatedLoot.get(member.id) ?? new Bank();
					bank.add(loot.get(member.id)!);
					simulatedLoot.set(member.id, bank);
				}
			}
			for (const [userIndex, user] of allUsers.entries()) {
				const member = raid.members.find(member => member.id === user.id)!;
				deathCounts.set(user.id, deathCounts.get(user.id)! + member.deaths.length);
				deathFees.set(
					user.id,
					deathFees.get(user.id)! + tfaDeathFee(raid, startingKCs[userIndex] + completions)
				);
				if (raid.wipedRoom !== null) continue;
				const userLoot = loot.get(user.id)!;
				teamLoot.add(user.id, userLoot);
				const xp = xpCounters.get(user.id)!;
				const participation = (raid.route.length - member.deaths.length) / raid.route.length;
				if (participation > 0) {
					let styles = resolveAttackStyles({ attackStyles: user.getAttackStyles() });
					if (styles.some(style => style === 'magic' || style === 'ranged'))
						styles = ['attack', 'strength', 'defence'];
					for (const style of styles)
						xp.add(style, Math.floor((TFA_BALANCING.xp.melee * participation) / styles.length));
					xp.add('ranged', Math.floor(TFA_BALANCING.xp.ranged * participation));
					xp.add('magic', Math.floor(TFA_BALANCING.xp.magic * participation));
					xp.add('hitpoints', Math.floor(TFA_BALANCING.xp.hitpoints * participation));
				}
				const uniques = userLoot.filter(item => TFAUniques.includes(item.id));
				if (uniques.length > 0) {
					globalClient.emit(
						Events.ServerNotification,
						`${Emoji.Purple} ${user.badgedUsername} received **${uniques}** on their ${formatOrdinal(startingKCs[userIndex] + completions + 1)} Fractured Archive completion. Apparently opening random doors works.`
					);
				}
			}
			if (raid.wipedRoom !== null) {
				results.push(
					`${raids.length > 1 ? `Raid ${index + 1}: ` : ''}Wiped at ${TFABosses[raid.route[raid.wipedRoom]].name}.`
				);
			} else {
				completions++;
				results.push(
					`${raids.length > 1 ? `Raid ${index + 1}: completed · ` : ''}${uniqueChance.toFixed(2)}% estimated team purple chance.`
				);
			}
		}

		const files = [];
		const playerMessages = [];
		const costUsers = [];
		const totalCost = new Bank();
		for (const [index, user] of allUsers.entries()) {
			const loot = teamLoot.get(user.id);
			if (completions > 0) {
				// A spawned/banked record without a CL entry must not block its earned milestone reward.
				// Checking the log also catches up any missed tiers on the next successful completion.
				const claimedRecords = user.cl.clone().add(loot);
				for (const [tier, requiredKC] of TFA_BALANCING.livingRecordKC.entries()) {
					if (startingKCs[index] + completions >= requiredKC && !claimedRecords.has(TFALivingRecords[tier])) {
						loot.add(TFALivingRecords[tier]);
					}
				}
				await user.incrementMinigameScore('fractured_archive', completions);
			}
			const xp = xpCounters.get(user.id)!;
			const xpMessage =
				xp.length > 0
					? await user.addXPCounter({ xpCounter: xp, source: 'FracturedArchive', minimal: true })
					: '';
			const fee = deathFees.get(user.id)!;
			const refund = deathFeeReserved * raids.length - fee;
			// Older trips recorded supplies at departure. Only trips carrying this reservation
			// can return quartermaster replacements and finalise their supply costs here.
			const reservation = data.supplies?.find(supply => supply.userID === user.id);
			const reserved = new Bank(reservation?.cost);
			const supplyRefund = reservation
				? raids.reduce(
						(bank, raid) => bank.add(tfaQuartermasterRefund(raid, user.id, reserved, raids.length)),
						new Bank()
					)
				: new Bank();
			const returned = supplyRefund.clone().add('Coins', Math.max(0, refund));
			if (returned.length > 0) await user.addItemsToBank({ items: returned, collectionLog: false });
			const deaths = deathCounts.get(user.id)!;
			const purple = TFAUniques.some(id => loot.has(id));
			playerMessages.push(
				[
					`${purple ? `${Emoji.Purple} ` : ''}${user.mention}${loot.length > 0 ? ` received ${purple ? `||${loot}||` : loot}.` : ''}`,
					`${deaths} ${deaths === 1 ? 'death' : 'deaths'} · ${fee.toLocaleString()} GP fee${refund > 0 ? ` · ${refund.toLocaleString()} GP returned` : ''}`,
					supplyRefund.length > 0 ? `Quartermaster returned ${supplyRefund}.` : '',
					xpMessage
				]
					.filter(Boolean)
					.join('\n')
			);
			const actualCost = reserved.remove(supplyRefund).add('Coins', fee);
			await user.statsBankUpdate('tfa_cost', actualCost);
			await user.statsBankUpdate('tfa_loot', loot);
			await user.statsUpdate({
				tfa_attempts: { increment: raids.length },
				tfa_deaths: { increment: deathCounts.get(user.id)! }
			});
			costUsers.push({ id: user.id, cost: actualCost });
			totalCost.add(actualCost);
			const { previousCL } = await user.addItemsToBank({ items: loot, collectionLog: true });
			if (loot.length > 0 && allUsers.length <= 3) {
				files.push(
					await makeBankImage({ bank: loot, user, previousCL, title: 'Loot from the Fractured Archive' })
				);
			}
		}
		await trackLoot({
			id: 'fractured_archive',
			type: 'Minigame',
			changeType: 'cost',
			totalCost,
			users: costUsers
		});
		const totalLoot = teamLoot.totalLoot();
		await trackLoot({
			id: 'fractured_archive',
			type: 'Minigame',
			changeType: 'loot',
			duration,
			kc: completions,
			totalLoot,
			users: allUsers.map(user => ({ id: user.id, loot: teamLoot.get(user.id), duration }))
		});
		const simulatedPurples = Array.from(simulatedLoot.values()).flatMap((loot, index) => {
			const uniques = loot.filter(item => TFAUniques.includes(item.id));
			return uniques.length > 0 ? [`${Emoji.Purple} Copy #${index + 1}: ||${uniques}||`] : [];
		});
		const content = [
			`**TFA: ${completions}/${raids.length} completed**\n${results.join('\n')}`,
			...playerMessages,
			simulatedPurples.length > 0 ? `**Simulated purples (not banked):**\n${simulatedPurples.join('\n')}` : ''
		]
			.filter(Boolean)
			.join('\n\n');
		await handleTripFinish({
			user: leader,
			channelId,
			data,
			loot: totalLoot,
			message: {
				content,
				files
			}
		});
		await autoRepeatTFATrip(data, leader, rng);
	}
};
