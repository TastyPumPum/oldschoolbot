import { Emoji, Events, formatOrdinal } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { trackLoot } from '@/lib/lootTrack.js';
import { resolveAttackStyles } from '@/lib/minions/functions/index.js';
import { TeamLoot } from '@/lib/simulation/TeamLoot.js';
import { rollTFALoot, TFA_BALANCING, TFABosses, TFALivingRecords, TFAUniques } from '@/lib/simulation/tfa.js';
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
		const simulatedLoot = new Map<string, Bank>();
		const deathFees = new Map(users.map(id => [id, 0]));
		const deathCounts = new Map(users.map(id => [id, 0]));
		const xpCounters = new Map(users.map(id => [id, new XPCounter()]));
		const results: string[] = [];
		let completions = 0;
		for (const [index, raid] of raids.entries()) {
			const { loot, uniqueChance } = rollTFALoot(raid, rng);
			if (data.fakeMass) {
				for (const member of raid.members) {
					if (member.id === data.leader) continue;
					const bank = simulatedLoot.get(member.id) ?? new Bank();
					bank.add(loot.get(member.id)!);
					simulatedLoot.set(member.id, bank);
				}
			}
			const route = raid.route.map(boss => TFABosses[boss].name).join(' → ');
			for (const [userIndex, user] of allUsers.entries()) {
				const member = raid.members.find(member => member.id === user.id)!;
				deathCounts.set(user.id, deathCounts.get(user.id)! + member.deaths.length);
				if (member.deaths.length > 0) {
					const fee =
						startingKCs[userIndex] + completions < TFA_BALANCING.learnerCompletions
							? TFA_BALANCING.learnerDeathFee
							: TFA_BALANCING.deathFee;
					deathFees.set(user.id, deathFees.get(user.id)! + fee);
				}
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
					`**Raid ${index + 1}:** Wiped at ${TFABosses[raid.route[raid.wipedRoom]].name}. Your minions have filed this under "learning experience".\n${route}`
				);
			} else {
				completions++;
				results.push(
					`**Raid ${index + 1}:** Completed! Estimated team purple chance: ${uniqueChance.toFixed(2)}%.\n${route}`
				);
			}
		}

		const files = [];
		const xpMessages = [];
		const costUsers = [];
		const totalFees = new Bank();
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
			if (xp.length > 0) {
				xpMessages.push(
					`${user.mention}: ${await user.addXPCounter({ xpCounter: xp, source: 'FracturedArchive', minimal: true })}`
				);
			}
			const fee = deathFees.get(user.id)!;
			const refund = deathFeeReserved * raids.length - fee;
			if (refund > 0) await user.addItemsToBank({ items: new Bank().add('Coins', refund), collectionLog: false });
			const feeBank = new Bank().add('Coins', fee);
			await user.statsBankUpdate('tfa_cost', feeBank);
			await user.statsBankUpdate('tfa_loot', loot);
			await user.statsUpdate({
				tfa_attempts: { increment: raids.length },
				tfa_deaths: { increment: deathCounts.get(user.id)! }
			});
			costUsers.push({ id: user.id, cost: feeBank });
			totalFees.add(feeBank);
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
			totalCost: totalFees,
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
		const feesMessage = allUsers
			.map(
				user =>
					`${user.mention}: ${deathCounts.get(user.id)} deaths, ${deathFees.get(user.id)!.toLocaleString()} GP death fee`
			)
			.join('\n');
		const simulatedLootMessage = data.fakeMass
			? `\n\n**Simulated copies' loot (not banked):**\n${Array.from(simulatedLoot.values())
					.map(
						(loot, index) =>
							`${TFAUniques.some(id => loot.has(id)) ? `${Emoji.Purple} ` : ''}Copy #${index + 1}: ||${loot.length > 0 ? loot.toString() : 'No loot. Still confused.'}||`
					)
					.join('\n')}`
			: '';
		await handleTripFinish({
			user: leader,
			channelId,
			data,
			loot: totalLoot,
			message: {
				content: `**The Fractured Archive: ${completions}/${raids.length} completed**\nYour minions have returned. Their understanding of the raid remains provisional.\n\n${results.join('\n\n')}\n\n${teamLoot.formatLoot()}\n${feesMessage}\n\n${xpMessages.join('\n')}${simulatedLootMessage}`,
				files
			}
		});
		await autoRepeatTFATrip(data, leader, rng);
	}
};
