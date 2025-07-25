import { calcPerHour, formatDuration } from '@oldschoolgg/toolkit/util';
import { ChannelType, type ChatInputCommandInteraction, type TextChannel, userMention } from 'discord.js';
import { Bank } from 'oldschooljs';

import { trackLoot } from '../../../lib/lootTrack';
import { setupParty } from '../../../lib/party';
import { calculateNexDetails, checkNexUser } from '../../../lib/simulation/nex';
import type { NexTaskOptions } from '../../../lib/types/minions';
import addSubTaskToActivityTask from '../../../lib/util/addSubTaskToActivityTask';
import { deferInteraction } from '../../../lib/util/interactionReply';
import { updateBankSetting } from '../../../lib/util/updateBankSetting';

export async function nexCommand(
	interaction: ChatInputCommandInteraction,
	user: MUser,
	channelID: string,
	solo: boolean | undefined
) {
	const ownerCheck = checkNexUser(user);
	if (ownerCheck[1]) {
		return `You can't start a Nex mass: ${ownerCheck[1]}`;
	}

	await deferInteraction(interaction);

	let mahojiUsers: MUser[] = [];

	if (solo) {
		mahojiUsers = [user];
	} else {
		const channel = globalClient.channels.cache.get(channelID.toString());
		if (!channel || channel.type !== ChannelType.GuildText) return 'You need to run this in a text channel.';

		let usersWhoConfirmed: MUser[] = [];
		try {
			usersWhoConfirmed = await setupParty(channel as TextChannel, user, {
				minSize: 1,
				maxSize: 10,
				leader: user,
				ironmanAllowed: true,
				message: `${user} is hosting a Nex mass! Use the buttons below to join/leave.`,
				customDenier: async user => checkNexUser(await mUserFetch(user.id))
			});
		} catch (err: any) {
			return {
				content: typeof err === 'string' ? err : 'Your mass failed to start.',
				ephemeral: true
			};
		}
		usersWhoConfirmed = usersWhoConfirmed.filter(i => !i.minionIsBusy);

		if (usersWhoConfirmed.length < 1 || usersWhoConfirmed.length > 10) {
			return `${user}, your mass didn't start because it needs between 1-10 users.`;
		}
		mahojiUsers = await Promise.all(usersWhoConfirmed.map(i => mUserFetch(i.id)));
	}

	for (const user of mahojiUsers) {
		const result = checkNexUser(user);
		if (result[1]) {
			return result[1];
		}
	}

	const details = await calculateNexDetails({
		team: mahojiUsers.length === 1 ? [mahojiUsers[0], mahojiUsers[0], mahojiUsers[0], mahojiUsers[0]] : mahojiUsers
	});

	const effectiveTeam = details.team.filter(m => !m.fake);

	for (const user of effectiveTeam) {
		const mUser = await mUserFetch(user.id);
		if (!mUser.allItemsOwned.has(user.cost)) {
			return `${mUser.usernameOrMention} doesn't have the required items: ${user.cost}.`;
		}
	}

	const removeResult = await Promise.all(
		effectiveTeam.map(async i => {
			const mUser = await mUserFetch(i.id);
			return {
				id: mUser.id,
				cost: (await mUser.specialRemoveItems(i.cost)).realCost
			};
		})
	);

	const totalCost = new Bank();
	for (const u of removeResult) totalCost.add(u.cost);

	await Promise.all([
		await updateBankSetting('nex_cost', totalCost),
		await trackLoot({
			totalCost,
			id: 'nex',
			type: 'Monster',
			changeType: 'cost',
			users: removeResult.map(i => ({
				id: i.id,
				cost: i.cost
			}))
		})
	]);

	await addSubTaskToActivityTask<NexTaskOptions>({
		userID: user.id,
		channelID: channelID.toString(),
		duration: details.duration,
		type: 'Nex',
		leader: user.id,
		users: effectiveTeam.map(i => i.id),
		teamDetails: details.team.map(i => [i.id, i.teamID, i.contribution, i.deaths, i.fake]),
		fakeDuration: details.fakeDuration,
		quantity: details.quantity,
		wipedKill: details.wipedKill
	});

	const str = `${user.usernameOrMention}'s party (${mahojiUsers
		.map(u => u.usernameOrMention)
		.join(', ')}${solo ? ' and 3 others' : ''}) is now off to kill ${details.quantity}x Nex! (${calcPerHour(
		details.quantity,
		details.fakeDuration
	).toFixed(1)}/hr) - the total trip will take ${formatDuration(details.fakeDuration)}.

${effectiveTeam
	.map(i => {
		return `${userMention(i.id)}: Contrib[${i.contribution.toFixed(2)}%] Death[${i.deathChance.toFixed(
			2
		)}%] Offence[${Math.round(i.totalOffensivePecent)}%] Defence[${Math.round(
			i.totalDefensivePercent
		)}%] *${i.messages.join(', ')}*`;
	})
	.join('\n')}
`;

	return str;
}
