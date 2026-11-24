import { ButtonBuilder, ButtonStyle, SpecialResponse, userMention } from '@oldschoolgg/discord';
import { Time, UserError } from '@oldschoolgg/toolkit';
import { toKMB } from 'oldschooljs';

import type { Bingo, BingoTeam, Prisma } from '@/prisma/main.js';

// Retry concurrent joins/roster changes without overfilling teams or charging twice.
export async function bingoTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await prisma.$transaction(fn, { isolationLevel: 'Serializable' });
		} catch (err) {
			if ((err as { code?: string }).code === 'P2034' && attempt < 4) continue;
			if ((err as { code?: string }).code === 'P2002') {
				throw new UserError('You are already in a team for this bingo.');
			}
			throw err;
		}
	}
}

function checkRegistration(bingo: Bingo, guildId: string | null) {
	if (bingo.was_finalized || bingo.start_date.getTime() <= Date.now()) {
		throw new UserError('You can only register or change a bingo team before the bingo starts.');
	}
	if (!guildId || (!bingo.is_global && bingo.guild_id !== guildId)) {
		throw new UserError('You must join this bingo from the server it was created in.');
	}
}

async function checkPlayer(tx: Prisma.TransactionClient, bingo: Bingo, userId: string) {
	const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
	if (await Cache.isUserBlacklisted(userId))
		throw new UserError(`${userMention(userId)} is blacklisted and cannot join bingo teams.`);
	if (!user.minion_ironman && user.GP < bingo.ticket_price) {
		throw new UserError(`${userMention(userId)} needs ${toKMB(Number(bingo.ticket_price))} GP to buy a ticket.`);
	}
	return user;
}

export async function createBingoTeam(
	bingoId: number,
	userId: string,
	guildId: string | null,
	sameServerOnly: boolean
) {
	return bingoTransaction(async tx => {
		const bingo = await tx.bingo.findUniqueOrThrow({ where: { id: bingoId } });
		checkRegistration(bingo, guildId);
		await checkPlayer(tx, bingo, userId);
		return tx.bingoTeam.create({
			data: {
				bingo_id: bingoId,
				creator_id: userId,
				guild_id: guildId,
				same_server_only: sameServerOnly,
				players_finalized: false,
				users: { create: { user_id: userId, bingo_id: bingoId, tickets_bought: 0 } }
			}
		});
	});
}

export async function joinBingoTeam(bingoId: number, teamId: number, userId: string, guildId: string | null) {
	return bingoTransaction(async tx => {
		const team = await tx.bingoTeam.findFirst({
			where: { id: teamId, bingo_id: bingoId },
			include: { bingo: true, users: true }
		});
		if (!team) throw new UserError('Invalid bingo team.');
		checkRegistration(team.bingo, guildId);
		if (team.players_finalized) throw new UserError('The creator has already finalised this team.');
		if (team.same_server_only && team.guild_id !== guildId) {
			throw new UserError('You must join this team from the server it was created in.');
		}
		if (team.kicked_user_ids.includes(userId))
			throw new UserError('You have been kicked from this team and cannot rejoin it.');
		if (
			await tx.bingoParticipant.findUnique({
				where: { user_id_bingo_id: { user_id: userId, bingo_id: bingoId } }
			})
		) {
			throw new UserError('You are already in a team for this bingo.');
		}
		if (team.users.length >= team.bingo.team_size) throw new UserError('This bingo team is full.');
		await checkPlayer(tx, team.bingo, userId);
		await tx.bingoParticipant.create({
			data: { bingo_id: bingoId, bingo_team_id: teamId, user_id: userId, tickets_bought: 0 }
		});
		return `You joined team ${teamId} (${team.users.length + 1}/${team.bingo.team_size}). The creator must finalise the roster before the bingo starts. Your ticket will be charged then.`;
	});
}

export async function manageBingoTeam(
	bingoId: number,
	creatorId: string,
	action: 'finalize' | 'cancel' | 'kick',
	targetId?: string
) {
	const result = await bingoTransaction(async tx => {
		const team = await tx.bingoTeam.findFirst({
			where: { bingo_id: bingoId, creator_id: creatorId },
			include: { bingo: true, users: true }
		});
		if (!team) throw new UserError('You are not the creator of a team in this bingo.');
		// Unfinished lobbies can still be cancelled after registration closes; no money was taken.
		if (action !== 'cancel' || team.players_finalized) checkRegistration(team.bingo, team.guild_id);
		if (action === 'cancel') {
			await refundTeam(tx, team.users, team.bingo.ticket_price);
			await tx.bingoTeam.delete({ where: { id: team.id } });
			return {
				content: 'Your team was cancelled. Any paid tickets were refunded.',
				users: team.users.map(p => p.user_id)
			};
		}
		if (team.players_finalized)
			throw new UserError(
				'This team has already been finalised. Cancel it before the bingo starts to change its roster.'
			);
		if (action === 'kick') {
			if (targetId === creatorId) throw new UserError('You cannot kick yourself. Cancel your team instead.');
			if (!targetId || !team.users.some(p => p.user_id === targetId))
				throw new UserError('That player is not in your team.');
			await tx.bingoParticipant.delete({ where: { user_id_bingo_id: { user_id: targetId, bingo_id: bingoId } } });
			await tx.bingoTeam.update({ where: { id: team.id }, data: { kicked_user_ids: { push: targetId } } });
			return {
				content: `${userMention(targetId)} was kicked from team ${team.id} and cannot rejoin it.`,
				users: []
			};
		}
		if (team.users.length !== team.bingo.team_size)
			throw new UserError(
				`Your team must have exactly ${team.bingo.team_size} players before it can be finalised.`
			);
		for (const participant of [...team.users].sort((a, b) => a.user_id.localeCompare(b.user_id))) {
			const user = await checkPlayer(tx, team.bingo, participant.user_id);
			if (!user.minion_ironman) {
				const { count } = await tx.user.updateMany({
					where: { id: user.id, minion_ironman: false, GP: { gte: team.bingo.ticket_price } },
					data: { GP: { decrement: team.bingo.ticket_price } }
				});
				if (count !== 1) throw new UserError(`${userMention(user.id)} can no longer afford a ticket.`);
			}
			await tx.bingoParticipant.update({
				where: { user_id_bingo_id: { user_id: participant.user_id, bingo_id: bingoId } },
				data: { tickets_bought: user.minion_ironman ? 0 : 1 }
			});
		}
		checkRegistration(team.bingo, team.guild_id);
		await tx.bingoTeam.update({ where: { id: team.id }, data: { players_finalized: true } });
		return {
			content: `Team ${team.id} has been finalised. Tickets have been charged to non-ironmen. Have fun!`,
			users: team.users.map(p => p.user_id)
		};
	});
	await Promise.all(result.users.map(async id => (await mUserFetch(id)).sync()));
	return result.content;
}

async function refundTeam(
	tx: Prisma.TransactionClient,
	participants: { user_id: string; tickets_bought: number }[],
	ticketPrice: bigint
) {
	for (const participant of [...participants].sort((a, b) => a.user_id.localeCompare(b.user_id))) {
		if (participant.tickets_bought === 0) continue;
		await tx.user.updateMany({
			where: { id: participant.user_id, minion_ironman: false },
			data: { GP: { increment: ticketPrice * BigInt(participant.tickets_bought) } }
		});
	}
}

export async function leaveBingoTeam(bingoId: number, userId: string) {
	const result = await bingoTransaction(async tx => {
		const participant = await tx.bingoParticipant.findUnique({
			where: { user_id_bingo_id: { user_id: userId, bingo_id: bingoId } },
			include: { team: { include: { bingo: true, users: true } } }
		});
		if (!participant) throw new UserError("You're not in a team for this bingo.");
		const { team } = participant;
		if (team.players_finalized) checkRegistration(team.bingo, team.guild_id ?? team.bingo.guild_id);
		if (!team.players_finalized && team.creator_id !== userId) {
			await tx.bingoParticipant.delete({ where: { user_id_bingo_id: { user_id: userId, bingo_id: bingoId } } });
			return { content: 'You left the team lobby. No ticket was charged.', users: [] };
		}
		await refundTeam(tx, team.users, team.bingo.ticket_price);
		await tx.bingoTeam.delete({ where: { id: team.id } });
		return {
			content:
				'Your team was disbanded. Any paid tickets were refunded; everyone can join or create another team.',
			users: team.users.map(p => p.user_id)
		};
	});
	await Promise.all(result.users.map(async id => (await mUserFetch(id)).sync()));
	return result.content;
}

export async function showBingoTeamLobby(
	interaction: MInteraction,
	bingo: Bingo,
	team: BingoTeam,
	invitedIds: string[]
) {
	const teamId = team.id;
	const joinId = `DYN_BINGO_JOIN_${teamId}`;
	const buttons = [new ButtonBuilder().setCustomId(joinId).setLabel('Join team').setStyle(ButtonStyle.Primary)];
	const content = `Created team ${teamId} for **${bingo.title}**. ${invitedIds.map(userMention).join(' ')}
Join using /bingo join bingo:${bingo.id} team:${teamId}. Players can join until all ${bingo.team_size} places are filled or the creator finalises the roster, before <t:${Math.floor(bingo.start_date.getTime() / 1000)}:F>.
${!bingo.is_global || team.same_server_only ? 'Players must join from the server this lobby was created in.' : 'This global bingo lobby accepts players from any server.'}
Joining agrees to a ${toKMB(Number(bingo.ticket_price))} GP ticket charged when the creator finalises; ironmen enter free. No payment is taken for an unfinished lobby.
The creator can use /bingo kick to remove players, or /bingo manage_team to finalise or cancel. Finalisation requires exactly ${bingo.team_size} players.
These quick-join buttons last 30 seconds. /bingo join continues to work afterwards.`;
	await interaction.reply({ content, components: buttons, allowedMentions: { parse: [], users: invitedIds } });
	const collector = globalClient.createInteractionCollector({
		interaction,
		timeoutMs: 30 * Time.Second,
		maxCollected: Infinity
	});
	collector.on('collect', async button => {
		if (button.customId !== joinId) return;
		try {
			await button.defer({ ephemeral: true });
			if (await (await mUserFetch(button.userId)).getIsLocked())
				throw new UserError('You cannot join a team while another command is running.');
			const response = await joinBingoTeam(bingo.id, teamId, button.userId, button.guildId);
			await button.reply({ content: response, ephemeral: true });
		} catch (err) {
			if (!(err instanceof UserError)) Logging.logError(err as Error);
			await button.reply({
				content: err instanceof UserError ? err.message : 'Unable to join the team. Please try /bingo join.',
				ephemeral: true
			});
		}
	});
	collector.on('end', async () => {
		await interaction.reply({ content, components: [] }).catch(err => Logging.logError(err));
	});
	collector.on('error', err => Logging.logError(err as Error));
	return SpecialResponse.RespondedManually;
}
