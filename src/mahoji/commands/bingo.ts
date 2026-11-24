import { bold, dateFm, userMention } from '@oldschoolgg/discord';
import { Emoji, formatOrdinal, notEmpty, Time, truncateString, UserError, uniqueArr } from '@oldschoolgg/toolkit';
import { isValidDiscordSnowflake } from '@oldschoolgg/util';
import { Bank, type ItemBank, toKMB } from 'oldschooljs';

import type { Bingo, Prisma } from '@/prisma/main.js';
import { cachedBingoBoard } from '@/lib/bingo/bingoRenderer.js';
import { clImageGenerator } from '@/lib/collectionLogTask.js';
import { BOT_TYPE } from '@/lib/constants.js';
import { doMenuWrapper } from '@/lib/menuWrapper.js';
import { isValidNickname } from '@/lib/util/smallUtils.js';
import { BingoManager, BingoTrophies } from '@/mahoji/lib/bingo/BingoManager.js';
import {
	bingoTransaction,
	createBingoTeam,
	joinBingoTeam,
	leaveBingoTeam,
	manageBingoTeam,
	showBingoTeamLobby
} from '@/mahoji/lib/bingo/bingoTeams.js';
import { bingoTileQuantity, getAllTileItems } from '@/mahoji/lib/bingo/bingoUtil.js';
import {
	importBingoConfiguration,
	manageSeasonalBingo,
	seasonalCreateOptions,
	seasonalManageOptions
} from '@/mahoji/lib/bingo/seasonalBingo.js';

const bingoAutocomplete = async ({ value, user, guildId }: StringAutoComplete) => {
	const bingos = await prisma.bingo.findMany({
		where: {
			OR: [
				{ bingo_participant: { some: { user_id: user.id } } },
				{ creator_id: user.id },
				{ organizers: { has: user.id } },
				{ is_global: true },
				...(guildId ? [{ guild_id: guildId }] : [])
			]
		},
		orderBy: { start_date: 'desc' }
	});
	return bingos
		.map(i => new BingoManager(i))
		.filter(
			bingo => !value || bingo.id.toString() === value || bingo.title.toLowerCase().includes(value.toLowerCase())
		)
		.slice(0, 25)
		.map(bingo => ({ name: truncateString(bingo.title, 100), value: bingo.id.toString() }));
};

type MakeTeamOptions = {
	same_server_only?: boolean;
	second_user?: MahojiUserOption;
	third_user?: MahojiUserOption;
	fourth_user?: MahojiUserOption;
	fifth_user?: MahojiUserOption;
} & {
	bingo: string;
};

export async function fetchBingosThatUserIsInvolvedIn(userId: string) {
	const bingos = await prisma.bingo.findMany({
		where: {
			OR: [
				{
					bingo_participant: {
						some: {
							user_id: userId
						}
					}
				},
				{
					creator_id: userId
				},
				{
					organizers: {
						has: userId
					}
				}
			]
		}
	});

	return bingos;
}

async function bingoTeamLeaderboard(interaction: MInteraction, bingo: BingoManager): CommandResponse {
	const teams = await bingo.fetchLeaderboardTeams();
	if (teams.length === 0)
		return `**${bingo.title}** has no teams on its leaderboard yet. Players can join before it starts using /bingo make_team.`;

	const users = await Promise.all(
		[...teams]
			.sort((a, b) => b.tilesCompletedCount - a.tilesCompletedCount)
			.map(async team => {
				const names = await Promise.all(team.participants.map(pt => Cache.getBadgedUsername(pt.user_id)));
				const label = `${team.trophy?.emoji ? `${team.trophy.emoji} ` : ''}Team ${team.team_id}: ${names.join(', ')}`;
				return {
					id: team.team_id.toString(),
					score: team.tilesCompletedCount,
					customName: label,
					team: true as const
				};
			})
	);

	return doMenuWrapper({
		ironmanOnly: false,
		interaction,
		users,
		title: `${bingo.title} — Team Leaderboard`,
		formatter: v => v.toLocaleString()
	});
}

async function makeTeamCommand(interaction: MInteraction, bingo: Bingo, creatorUser: MUser, options: MakeTeamOptions) {
	const invitedIds = uniqueArr(
		[
			options.second_user?.user.id,
			options.third_user?.user.id,
			options.fourth_user?.user.id,
			options.fifth_user?.user.id
		].filter(notEmpty)
	).filter(id => id !== creatorUser.id);
	if (invitedIds.length + 1 > bingo.team_size) return `Your team can have at most ${bingo.team_size} players.`;
	await interaction.confirmation(
		`Create a team lobby for **${bingo.title}**? Your ${toKMB(Number(bingo.ticket_price))} GP ticket will be charged when you finalise the full roster. Ironmen enter free. Invited players must join themselves.`
	);
	const team = await createBingoTeam(bingo.id, creatorUser.id, interaction.guildId, options.same_server_only ?? true);
	return showBingoTeamLobby(interaction, bingo, team, invitedIds);
}

async function leaveTeamCommand(interaction: MInteraction, bingo: BingoManager) {
	await interaction.confirmation(
		'Leave your team? Leaving an unfinished lobby removes only you. If you created the lobby, or the team is already finalised, the whole team is disbanded and paid tickets are refunded.'
	);
	return leaveBingoTeam(bingo.id, interaction.userId);
}

export async function getBingoFromUserInput(input: string | undefined, userID?: string, guildID?: string | null) {
	if (!input) {
		if (!userID) return null;
		const bingos = await prisma.bingo.findMany({
			where: {
				OR: [
					{ bingo_participant: { some: { user_id: userID } } },
					{ creator_id: userID },
					{ organizers: { has: userID } },
					{ is_global: true },
					...(guildID ? [{ guild_id: guildID }] : [])
				]
			},
			include: { bingo_participant: { where: { user_id: userID } } },
			orderBy: { start_date: 'desc' }
		});
		const current = bingos.filter(
			b => !b.was_finalized && new Date(b.start_date.getTime() + b.duration_days * Time.Day) > new Date()
		);
		const joined = current.filter(b => b.bingo_participant.length > 0);
		return (
			joined.find(b => b.start_date <= new Date()) ??
			joined[0] ??
			current.find(b => b.creator_id === userID || b.organizers.includes(userID)) ??
			current.find(b => b.start_date <= new Date()) ??
			current[0] ??
			bingos.find(b => b.bingo_participant.length > 0) ??
			bingos[0] ??
			null
		);
	}
	const where = Number.isNaN(Number(input))
		? {
				title: input
			}
		: {
				id: Number(input)
			};
	const bingo = await prisma.bingo.findFirst({
		where
	});
	return bingo;
}

export const bingoCommand = defineCommand({
	name: 'bingo',
	description: 'Bingo!',
	options: [
		{
			type: 'Subcommand',
			name: 'make_team',
			description: 'Make your own bingo team, with other players.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo.',
					required: true,
					autocomplete: async ({ value, guildId, userId }: StringAutoComplete) => {
						if (!guildId) return [];
						const member = await globalClient.fetchMember({ guildId, userId });
						if (!member || !member.guild_id) return [];
						const bingos = await prisma.bingo.findMany({
							where: {
								OR: [
									{
										guild_id: member.guild_id,
										was_finalized: false
									},
									{
										is_global: true,
										was_finalized: false
									}
								]
							}
						});
						return bingos
							.map(i => new BingoManager(i))
							.filter(bingo => !bingo.wasFinalized && new Date() < bingo.startDate)
							.filter(bingo => (!value ? true : bingo.id.toString() === value))
							.map(bingo => ({ name: bingo.title, value: bingo.id.toString() }));
					}
				},
				{
					type: 'User',
					name: 'second_user',
					description: 'Invite a second player to join your lobby.',
					required: false
				},
				{
					type: 'User',
					name: 'third_user',
					description: 'Invite a third player to join your lobby.',
					required: false
				},
				{
					type: 'User',
					name: 'fourth_user',
					description: 'Invite a fourth player to join your lobby.',
					required: false
				},
				{
					type: 'User',
					name: 'fifth_user',
					description: 'Invite a fifth player to join your lobby.',
					required: false
				},
				{
					type: 'Boolean',
					name: 'same_server_only',
					description:
						'Only allow joins from this server (default: true). Private bingos always require their server.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'join',
			description: 'Join a bingo team lobby and agree to its ticket price.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo.',
					required: true,
					autocomplete: bingoAutocomplete
				},
				{
					type: 'Integer',
					name: 'team',
					description: 'The team ID shown when its creator made the lobby.',
					required: true,
					min_value: 1
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'kick',
			description: 'Kick a player from your unfinished bingo team lobby and prevent them rejoining.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo.',
					required: true,
					autocomplete: bingoAutocomplete
				},
				{ type: 'User', name: 'user', description: 'The player to kick.', required: true }
			]
		},
		{
			type: 'Subcommand',
			name: 'manage_team',
			description: 'Finalise or cancel your bingo team.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo.',
					required: true,
					autocomplete: bingoAutocomplete
				},
				{
					type: 'Boolean',
					name: 'finalize_players',
					description: 'Close registration and pay for the full team roster.',
					required: false
				},
				{
					type: 'Boolean',
					name: 'cancel',
					description: 'Cancel your team and refund any paid tickets before the bingo starts.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'leave_team',
			description: 'Leave your bingo team.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo.',
					required: true,
					autocomplete: async ({ value, userId }: StringAutoComplete) => {
						const bingos = await prisma.bingo.findMany({
							where: {
								OR: [
									{
										bingo_participant: {
											some: {
												user_id: userId
											}
										}
									}
								]
							}
						});
						return bingos
							.map(i => new BingoManager(i))
							.filter(bingo => (!value ? true : bingo.id.toString() === value))
							.map(bingo => ({ name: bingo.title, value: bingo.id.toString() }));
					}
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'view',
			description: 'View bingo info.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo.',
					required: false,
					autocomplete: bingoAutocomplete
				},
				{
					type: 'Boolean',
					name: 'json',
					description: 'Download the current tile requirements as JSON.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'leaderboard',
			description: 'View the bingo leaderboard.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo to check the leaderboard of.',
					required: false,
					autocomplete: bingoAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'create_bingo',
			description: 'Create a bingo.',
			options: [
				{
					type: 'String',
					name: 'title',
					description: 'The title of the bingo.',
					required: true
				},
				{
					type: 'Integer',
					name: 'duration_days',
					description: 'The duration of the bingo in days.',
					required: true,
					min_value: 1,
					max_value: 31
				},
				{
					type: 'Integer',
					name: 'start_date_unix_seconds',
					description: 'The start date in unix seconds.',
					required: true
				},
				{
					type: 'Integer',
					name: 'ticket_price',
					description: 'The ticket price.',
					required: true,
					min_value: 1
				},
				{
					type: 'Integer',
					name: 'team_size',
					description: 'The team size.',
					required: true,
					min_value: 1,
					max_value: 5
				},
				{
					type: 'String',
					name: 'notifications_channel_id',
					description: 'The channel to send notifications to.',
					required: true
				},
				{
					type: 'String',
					name: 'organizers',
					description: 'The organizers (user IDs separated by comma).',
					required: true
				},
				...seasonalCreateOptions
			]
		},
		{
			type: 'Subcommand',
			name: 'manage_bingo',
			description: 'Manage your bingo.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo.',
					required: true,
					autocomplete: async ({ value, userId }: StringAutoComplete) => {
						const bingos = await fetchBingosThatUserIsInvolvedIn(userId);
						return bingos
							.map(i => new BingoManager(i))
							.filter(b => b.creatorID === userId || b.organizers.includes(userId))
							.filter(bingo => (!value ? true : bingo.id.toString() === value))
							.map(bingo => ({ name: bingo.title, value: bingo.id.toString() }));
					}
				},
				{
					type: 'Boolean',
					name: 'csv_dump',
					description: 'Dump a csv file with all the bingo results.',
					required: false
				},
				{
					type: 'Boolean',
					name: 'finalize',
					description: 'Finalize/end the bingo.',
					required: false
				},
				{
					type: 'Integer',
					name: 'add_extra_gp',
					description: 'Add extra gp to the prize.',
					required: false,
					min_value: 1_000_000
				},
				{
					type: 'Boolean',
					name: 'trophy_handout',
					description: 'Hand out trophies.',
					required: false
				},
				...seasonalManageOptions
			]
		},
		{
			type: 'Subcommand',
			name: 'items',
			description: 'View your progress/items.',
			options: [
				{
					type: 'String',
					name: 'bingo',
					description: 'The bingo to check your items of.',
					required: true,
					autocomplete: async ({ value, userId }: StringAutoComplete) => {
						const bingos = await fetchBingosThatUserIsInvolvedIn(userId);
						return bingos
							.map(i => new BingoManager(i))
							.filter(b => b.isActive())
							.filter(bingo => (!value ? true : bingo.id.toString() === value))
							.map(bingo => ({ name: bingo.title, value: bingo.id.toString() }));
					}
				}
			]
		}
	],
	run: async ({ user, options, interaction, guildId }) => {
		if (options.items) {
			const bingoID = Number(options.items.bingo);
			if (Number.isNaN(bingoID)) {
				return 'Invalid bingo.';
			}
			const bingoParticipant = await prisma.bingoParticipant.findFirst({
				where: {
					bingo_id: Number(options.items.bingo),
					user_id: user.id
				},
				include: {
					bingo: true
				}
			});

			if (!bingoParticipant) return 'Invalid bingo.';
			const bingo = new BingoManager(bingoParticipant.bingo);
			const teamProgress = await bingo.determineProgressOfTeam(bingoParticipant.bingo_team_id);
			if (!teamProgress)
				return 'Your team is still a lobby. Its creator must finalise the full roster before the bingo starts.';

			const clItems: number[] = [];

			for (const tile of teamProgress.tilesNotCompleted) {
				const tileItems = getAllTileItems(tile);
				clItems.push(...tileItems);
			}

			for (const tile of teamProgress.tilesCompleted) {
				if ('oneOf' in tile) {
					const completed = tile.oneOf.find(i => teamProgress.cl.has(i));
					if (completed) {
						clItems.push(completed);
					} else {
						clItems.push(...tile.oneOf);
					}
				}

				if ('allOf' in tile) {
					clItems.push(...tile.allOf);
				}

				if ('bank' in tile) {
					clItems.push(...getAllTileItems(tile));
				}

				if ('customReq' in tile) {
					clItems.push(...tile.allItems.filter(i => teamProgress.cl.has(i)));
				}
			}

			const image = await clImageGenerator.makeArbitraryCLImage({
				user,
				clItems: new Set(clItems),
				userBank: teamProgress.cl,
				title: 'Bingo'
			});

			return image;
		}
		if (options.make_team) {
			const bingo = await getBingoFromUserInput(options.make_team.bingo);
			if (!bingo) return 'Invalid bingo.';
			return makeTeamCommand(interaction, bingo, user, options.make_team);
		}
		if (options.join) {
			const bingo = await getBingoFromUserInput(options.join.bingo);
			if (!bingo) return 'Invalid bingo.';
			await interaction.confirmation(
				`Join team ${options.join.team} for **${bingo.title}**? You agree to pay ${toKMB(Number(bingo.ticket_price))} GP when its creator finalises the roster. Ironmen enter free. You can leave before finalisation.`
			);
			return joinBingoTeam(bingo.id, options.join.team, user.id, guildId);
		}
		if (options.kick || options.manage_team) {
			const input = options.kick ?? options.manage_team!;
			const bingo = await getBingoFromUserInput(input.bingo);
			if (!bingo) return 'Invalid bingo.';
			if (options.kick) return manageBingoTeam(bingo.id, user.id, 'kick', options.kick.user.user.id);
			const manage = options.manage_team!;
			if (Boolean(manage.finalize_players) === Boolean(manage.cancel))
				return 'Choose either finalize_players or cancel.';
			await interaction.confirmation(
				manage.cancel
					? 'Cancel your team? Any paid tickets will be refunded and all players will need to join or create another team.'
					: 'Finalise your full team roster? Non-ironmen will be charged their ticket price. Players cannot join or be kicked afterwards.'
			);
			return manageBingoTeam(bingo.id, user.id, manage.cancel ? 'cancel' : 'finalize');
		}
		if (options.leave_team) {
			const bingo = await getBingoFromUserInput(options.leave_team.bingo);
			if (!bingo) return 'Invalid bingo.';
			return leaveTeamCommand(interaction, new BingoManager(bingo));
		}
		if (options.leaderboard) {
			const bingo = await getBingoFromUserInput(options.leaderboard.bingo, user.id, guildId);
			if (!bingo) return 'No bingo found. Select a bingo, or create one using /bingo create_bingo.';
			return bingoTeamLeaderboard(interaction, new BingoManager(bingo));
		}

		if (options.create_bingo) {
			if (user.isIronman) {
				return 'Ironmen cannot create bingos.';
			}

			const bingoGuildId = interaction.guildId;
			if (!bingoGuildId) {
				return 'You must be a server administrator or have the bingo admin role to create a bingo.';
			}
			if (!interaction.member?.permissions.includes('ADMINISTRATOR')) {
				const guild = await Cache.getGuild(bingoGuildId);
				const member = guild.bingo_admin_role
					? await Cache.getMember({ guildId: bingoGuildId, userId: user.id, forceCheck: true })
					: null;
				if (
					!guild.bingo_admin_role ||
					!member ||
					(guild.bingo_admin_role !== bingoGuildId && !member.roles.includes(guild.bingo_admin_role))
				) {
					return 'You must be a server administrator or have the bingo admin role to create a bingo.';
				}
			}

			const tiles = await importBingoConfiguration(options.create_bingo.configuration);
			const fee = BOT_TYPE === 'OSB' ? 20_000_000 : 50_000_000;
			const creationCost = new Bank().add('Coins', fee);
			if (user.GP < creationCost.amount('Coins')) {
				return `You need at least ${creationCost} to create a bingo.`;
			}

			const channelId = options.create_bingo.notifications_channel_id;
			if (!isValidDiscordSnowflake(channelId)) {
				return "That's not a valid channel ID, if you need help on how to get a channel id, you can ask us for help.";
			}
			const channel = await Cache.getChannel(channelId);
			if (!channel || !channel.guild_id) {
				return 'Invalid notifications channel.';
			}
			if (channel.guild_id !== bingoGuildId) {
				return 'The notifications channel must be in the same server as the command.';
			}
			const sendable = await globalClient.channelIsSendable(channel);
			if (!sendable) {
				return 'I cannot send messages to the notifications channel.';
			}
			if (!isValidNickname(options.create_bingo.title)) {
				return 'Invalid title.';
			}

			const createOptions = {
				title: options.create_bingo.title,
				duration_days: options.create_bingo.duration_days,
				start_date: new Date(options.create_bingo.start_date_unix_seconds * 1000),
				ticket_price: options.create_bingo.ticket_price,
				team_size: options.create_bingo.team_size,
				notifications_channel_id: options.create_bingo.notifications_channel_id,
				organizers: options.create_bingo.organizers
					.split(',')
					.map(i => i.trim())
					.filter(id => isValidDiscordSnowflake(id)),
				bingo_tiles: tiles as unknown as Prisma.InputJsonObject[],
				theme: options.create_bingo.theme ?? null,
				creator_id: user.id,
				guild_id: bingoGuildId
			};

			if (createOptions.team_size < 1 || createOptions.team_size > 5) {
				return 'Team size must be between 1 and 5.';
			}

			// Start date must be at least 3 hours into the future
			if (createOptions.start_date.getTime() < Date.now() + Time.Minute * 3) {
				return 'Start date must be at least 3 minutes into the future.';
			}

			// Start date cannot be more than 31 days into the future
			if (createOptions.start_date.getTime() > Date.now() + Time.Day * 31) {
				return 'Start date cannot be more than 31 days into the future.';
			}

			const disclaimer = `You are creating a bingo, please adhere to these rules. If you are found to be breaking these rules, you will be banned.

- The title must not be inappropriate or offensive.
- The notifications channel ID must be of a server you own, or have consent to use. The bot will only let you use the channel if you are an Administrator of that server.
- The organisers must consent to being added as organisers of your Bingo. They can replace the tile configuration before the start and manage the Bingo.
- Once your Bingo starts, you cannot stop it, or change any settings. Ensure everything is accurate before then.
- You can only have 1 Bingo active at a time.
- Ironmen will be able to enter, for free. However, they cannot win rewards.
- ${
				options.create_bingo.configuration
					? 'Your board contains 28 imported tiles.'
					: 'Your board uses the starter 28 tiles. Upload a JSON configuration using /bingo manage_bingo to replace them before the start.'
			}

**Your Bingo settings(Can be edited):**
**Title:** ${createOptions.title} (*Cannot be changed after the bingo starts*)
**Duration:** ${createOptions.duration_days} days  (*Cannot be changed after the bingo starts*)
**Start Date:** ${dateFm(createOptions.start_date)} (*Cannot be changed after the bingo starts*)
**Finish Date:** ${dateFm(new Date(createOptions.start_date.getTime() + createOptions.duration_days * Time.Day))}
**Ticket Price:** ${toKMB(createOptions.ticket_price)} (*Cannot be changed later*)
**Team Size:** ${createOptions.team_size} (*Cannot be changed later*)
**Notifications Channel:** ${createOptions.notifications_channel_id}
**Organizers:** ${createOptions.organizers.map(userMention).join(', ')}

${Emoji.Warning} **You will pay a ${toKMB(fee)} GP fee to create this bingo, you will be charged after confirming.** ${
				Emoji.Warning
			}
`;

			await interaction.confirmation(disclaimer);

			await user.removeItemsFromBank(new Bank().add('Coins', fee));
			await prisma.bingo.create({
				data: createOptions
			});

			Logging.logDebug('Created bingo', createOptions);

			return 'Created your Bingo succesfully!';
		}

		if (options.manage_bingo) {
			if (!options.manage_bingo.bingo) {
				return 'You need to pick which bingo to manage.';
			}
			const _bingo = await getBingoFromUserInput(options.manage_bingo.bingo);
			if (!_bingo) return 'Invalid bingo.';
			if (_bingo.creator_id !== user.id && !_bingo.organizers.includes(user.id)) {
				return 'You are not an organizer of this bingo.';
			}
			const bingo = new BingoManager(_bingo);
			const seasonalResult = await manageSeasonalBingo(bingo, interaction, options.manage_bingo);
			if (seasonalResult !== null) return seasonalResult;
			if (options.manage_bingo.finalize) {
				if (user.id !== bingo.creatorID) {
					return 'Only the creator of the bingo can finalize it.';
				}
				const creator = await mUserFetch(bingo.creatorID);
				if (bingo.wasFinalized) {
					return 'This bingo was already finalized.';
				}
				await interaction.confirmation(
					`Are you sure you want to end the Bingo? ${bold('This cannot be undone.')}

The creator of the bingo (${userMention(
						bingo.creatorID
					)}) will receive the prize pool (currently ${toKMB(await bingo.countTotalGPInPrizePool())} GP), so they can distribute it. Unfinished team lobbies are excluded.`
				);

				const prize = await bingoTransaction(async tx => {
					const current = await tx.bingo.findUniqueOrThrow({ where: { id: bingo.id } });
					if (current.was_finalized) throw new UserError('This bingo was already finalised.');
					await tx.bingo.update({ where: { id: bingo.id }, data: { was_finalized: true } });
					const tickets = await tx.bingoParticipant.aggregate({
						where: {
							bingo_id: bingo.id,
							user: { minion_ironman: false },
							team: { players_finalized: true }
						},
						_sum: { tickets_bought: true }
					});
					const amount = BigInt(tickets._sum.tickets_bought ?? 0) * current.ticket_price + current.extra_gp;
					const { count } = await tx.user.updateMany({
						where: { id: creator.id, minion_ironman: false },
						data: { GP: { increment: amount } }
					});
					if (count !== 1) throw new UserError('Ironmen cannot receive the bingo prize pool.');
					return amount;
				});
				await creator.sync();
				const loot = new Bank().add('Coins', Number(prize));
				return `${creator} received ${loot}. The Bingo has now ended.`;
			}
			if (options.manage_bingo.csv_dump) {
				const { users, teams } = await bingo.fetchAllParticipants();
				return {
					files: [
						{
							buffer: Buffer.from(
								(
									await Promise.all(
										teams.map(team =>
											[
												team.participants
													.map(u => Cache.getBadgedUsername(u.user_id))
													.join(','),
												team.tilesCompletedCount,
												team.trophy?.item.name ?? 'No Trophy'
											].join('\t')
										)
									)
								).join('\n')
							),
							name: 'teams.txt'
						},
						{
							buffer: Buffer.from(users.map(u => [u.id, u.tilesCompletedCount].join('\t')).join('\n')),
							name: 'users.txt'
						}
					]
				};
			}

			if (options.manage_bingo.add_extra_gp) {
				const amount = Number(options.manage_bingo.add_extra_gp);
				if (Number.isNaN(amount) || amount < 1) {
					return 'Invalid amount.';
				}

				const cost = new Bank().add('Coins', amount);
				if (user.GP < cost.amount('Coins')) {
					return `You need at least ${cost} to add that much GP to the prize pool.`;
				}

				await interaction.confirmation(
					`Are you sure you want to add ${cost} to the prize pool? You cannot undo this.`
				);

				await user.removeItemsFromBank(cost);
				await prisma.bingo.update({
					where: {
						id: bingo.id
					},
					data: {
						extra_gp: {
							increment: amount
						}
					}
				});
				Logging.logDebug('Added extra gp to bingo', { bingoID: bingo.id, amount });

				return `Added ${cost} to the prize pool.`;
			}

			if (options.manage_bingo.trophy_handout) {
				if (!bingo.isGlobal || !bingo.wasFinalized || !bingo.trophiesApply) {
					return 'This bingo is not eligible for trophies.';
				}
				const result = await bingo.fetchAllParticipants();

				const toInsert: Prisma.ReclaimableItemCreateManyInput[] = [];

				for (const team of result.teams) {
					if (!team.trophy) continue;
					const trophiesToReceive = BingoTrophies.filter(
						trophy => trophy.percentile >= team.trophy!.percentile
					);

					for (const userId of team.participants.map(t => t.user_id)) {
						const reclaimableItems: Prisma.ReclaimableItemCreateManyInput[] = await Promise.all(
							trophiesToReceive.map(async trophy => ({
								name: `Bingo Trophy (${trophy.item.name})`,
								quantity: 1,
								key: `bso-bingo-2-${trophy.item.id}`,
								item_id: trophy.item.id,
								description: `Awarded for placing in the top ${trophy.percentile}% of ${
									bingo.title
								}. Your team (${(await Promise.all(team.participants.map(async t => await Cache.getBadgedUsername(t.user_id)))).join(', ')}) placed ${formatOrdinal(team.rank)} with ${
									team.tilesCompletedCount
								} tiles completed.`,
								date: bingo.endDate.toISOString(),
								user_id: userId
							}))
						);
						toInsert.push(...reclaimableItems);
					}
				}

				await prisma.reclaimableItem.createMany({
					data: toInsert
				});

				return 'Handed out trophies.';
			}
		}

		if (options.view || Object.keys(options).length === 0) {
			const _bingo = await getBingoFromUserInput(options.view?.bingo, user.id, guildId);
			if (!_bingo) return 'No bingo found. Select a bingo, or create one using /bingo create_bingo.';
			const bingo = new BingoManager(_bingo);
			if (options.view?.json) {
				return {
					content: `Tile requirements for **${bingo.title}**, listed in board order.`,
					allowed_mentions: { parse: [], users: [] },
					files: [
						{
							name: `bingo-${bingo.id}-tiles.json`,
							buffer: Buffer.from(JSON.stringify(bingo.rawBingoTiles, null, 2))
						}
					]
				};
			}

			const { teams } = await bingo.fetchAllParticipants();
			const lobbies = await prisma.bingoTeam.findMany({
				where: { bingo_id: bingo.id, players_finalized: false },
				include: { users: { select: { user_id: true } } },
				orderBy: { id: 'asc' }
			});
			const yourLobby = lobbies.find(team => team.users.some(p => p.user_id === user.id));
			const yourTeam = teams.find(t => t.participants.some(p => p.user_id === user.id));
			const yourParticipant = yourTeam?.participants.find(p => p.user_id === user.id);

			let progressString = '';
			if (yourTeam && yourParticipant) {
				const yourProgress = bingo.determineProgressOfBank(yourParticipant.cl as ItemBank);

				progressString =
					new Date() >= bingo.startDate
						? `You have ${yourProgress.tilesCompletedCount} tiles completed.
${yourProgress.bingoTableStr}
**Your team:** ${yourTeam.participants.map(p => userMention(p.user_id)).join(', ')}
Your team has ${yourTeam.tilesCompletedCount} tiles completed.
${yourTeam.bingoTableStr}`
						: '';

				if (bingo.isGlobal) {
					progressString += `\n${
						yourTeam.trophy
							? `**Trophy:** ${yourTeam.trophy.emoji} ${yourTeam.trophy.item.name}\n`
							: 'Your team has not qualified for a trophy.'
					}`;
				}
			}

			let lobbyString = '';
			if (yourLobby) {
				lobbyString = `**Your team lobby:** ${yourLobby.id} (${yourLobby.users.length}/${bingo.teamSize} players): ${yourLobby.users.map(p => userMention(p.user_id)).join(', ')}. No tickets have been charged.\n`;
			}
			if (!bingo.wasFinalized && new Date() < bingo.startDate) {
				lobbyString += `**Team lobbies:** ${lobbies.length}. Use /bingo make_team or /bingo join with a team ID. Players can join until a team is full or its creator finalises. The creator must use /bingo manage_team finalize_players:true before the start.\n`;
				lobbyString += lobbies
					.slice(0, 5)
					.map(
						team =>
							`Team ${team.id}: ${team.users.length}/${bingo.teamSize}, creator ${team.creator_id ? userMention(team.creator_id) : 'unknown'}`
					)
					.join('\n');
			} else if (yourLobby) {
				lobbyString +=
					'Registration has closed. This unfinished lobby will not score or be charged. Leave it with /bingo leave_team, or cancel it with /bingo manage_team cancel:true.\n';
			}
			const str = `**${bingo.title}** ${teams.length} teams, ${toKMB(await bingo.countTotalGPInPrizePool())} GP Prize Pool
**Start:** ${dateFm(bingo.startDate)}
**Finish:** ${dateFm(bingo.endDate)}
${lobbyString}
${progressString}
`;
			if (bingo.theme) {
				const teamID = yourTeam?.team_id ?? 0;
				const cl = yourTeam ? (await bingo.determineProgressOfTeam(teamID))!.cl : new Bank();
				const quantities = bingo.bingoTiles
					.flatMap(tile => {
						const quantity = bingoTileQuantity(tile, cl);
						return quantity
							? [`${tile.name}: ${quantity.current.toLocaleString()}/${quantity.target.toLocaleString()}`]
							: [];
					})
					.slice(0, 8);
				return {
					content: `${str}\n${yourTeam ? `Your team's seasonal board (team ${teamID}).` : 'Board preview. Join before the start using /bingo make_team.'}\n${quantities.join('\n')}`,
					allowed_mentions: { parse: [], users: [] },
					files: [
						{
							name: `bingo-${bingo.id}-team-${teamID}.png`,
							buffer: await cachedBingoBoard(bingo, teamID, cl)
						}
					]
				};
			}

			return {
				content: str,
				allowed_mentions: {
					parse: [],
					users: []
				},
				files: [
					{
						buffer: Buffer.from(bingo.bingoTiles.map((t, i) => `${++i}. ${t.name}`).join('\n')),
						name: 'tiles_board.txt'
					}
				]
			};
		}

		return 'Invalid command.';
	}
});
