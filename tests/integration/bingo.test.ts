import type { APIAttachment } from '@oldschoolgg/discord';
import { Bank, type ItemBank, itemID } from 'oldschooljs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Bingo, Prisma } from '@/prisma/main.js';
import { defaultBingoChallenges } from '@/lib/bingo/bingoChallenges.js';
import { clImageGenerator } from '@/lib/collectionLogTask.js';
import { bingoCommand, getBingoFromUserInput } from '@/mahoji/commands/bingo.js';
import { BingoManager, findBingosWithUserParticipating } from '@/mahoji/lib/bingo/BingoManager.js';
import { createBingoTeam, joinBingoTeam, leaveBingoTeam, manageBingoTeam } from '@/mahoji/lib/bingo/bingoTeams.js';
import { manageSeasonalBingo, parseBingoConfiguration } from '@/mahoji/lib/bingo/seasonalBingo.js';
import { createTestUser } from './util.js';

describe('Seasonal artwork on the existing team bingo system', () => {
	let bingo: Bingo;
	let teamID: number;
	let opponentID: number;
	let creator: Awaited<ReturnType<typeof createTestUser>>;
	beforeEach(async () => {
		creator = await createTestUser();
		bingo = await prisma.bingo.create({
			data: {
				creator_id: creator.id,
				title: 'Winter bingo',
				theme: 'winter',
				team_size: 2,
				ticket_price: 0,
				start_date: new Date(Date.now() - 60_000),
				duration_days: 1,
				guild_id: '1111111111111111',
				notifications_channel_id: '1111111111111111',
				bingo_tiles: parseBingoConfiguration(defaultBingoChallenges()) as unknown as Prisma.InputJsonObject[]
			}
		});
		teamID = (await prisma.bingoTeam.create({ data: { bingo_id: bingo.id } })).id;
		opponentID = (await prisma.bingoTeam.create({ data: { bingo_id: bingo.id } })).id;
	});
	afterEach(async () => {
		vi.restoreAllMocks();
		await prisma.bingoParticipant.deleteMany({ where: { bingo_id: bingo.id } });
		await prisma.bingoTeam.deleteMany({ where: { bingo_id: bingo.id } });
		await prisma.bingo.delete({ where: { id: bingo.id } });
	});
	async function join(team = teamID) {
		const user = await createTestUser();
		await prisma.bingoParticipant.create({
			data: { user_id: user.id, bingo_id: bingo.id, bingo_team_id: team, tickets_bought: 1 }
		});
		return user;
	}
	it('uses existing participant CLs for team progress, quantities and leaderboard rankings', async () => {
		const [first, second, opponent] = await Promise.all([join(), join(), join(opponentID)]);
		const manager = new BingoManager(bingo);
		await manager.handleNewItems(first.id, new Bank().add('Redwood logs', 1000));
		await manager.handleNewItems(second.id, new Bank().add('Redwood logs', 4000));
		await manager.handleNewItems(opponent.id, new Bank().add('Redwood logs', 1000));
		const progress = await manager.determineProgressOfTeam(teamID);
		expect(progress?.tilesCompletedCount).toBe(1);
		expect(progress?.cl.amount('Redwood logs')).toBe(5000);
		expect((await manager.determineProgressOfTeam(opponentID))?.tilesCompletedCount).toBe(0);
		const { teams } = await manager.fetchAllParticipants();
		expect(teams.map(t => [t.team_id, t.tilesCompletedCount])).toEqual([
			[teamID, 1],
			[opponentID, 0]
		]);
	});
	it('automatically uses the original bank reward hook without an activity context or event ledger', async () => {
		const user = await join();
		await user.addItemsToBank({ items: new Bank().add('Redwood logs', 5000), collectionLog: false });
		const spy = vi.spyOn(BingoManager.prototype, 'handleNewItems');
		await user.addItemsToBank({ items: new Bank().add('Redwood logs', 1000), collectionLog: true });
		// The established bank hook schedules these updates without awaiting them.
		await Promise.all(spy.mock.results.map(result => result.value));
		const participant = await prisma.bingoParticipant.findUniqueOrThrow({
			where: { user_id_bingo_id: { user_id: user.id, bingo_id: bingo.id } }
		});
		expect(new Bank(participant.cl as ItemBank).amount('Redwood logs')).toBe(1000);
	});
	it('grants normal loot to a former participant whose finished board contains catalogue references', async () => {
		const user = await join();
		await prisma.bingo.update({
			where: { id: bingo.id },
			data: {
				theme: null,
				was_finalized: true,
				start_date: new Date(Date.now() - 3 * 86_400_000),
				bingo_tiles: [{ global: 6 }, { global: 13 }, { global: 38 }]
			}
		});
		await user.addItemsToBank({ items: new Bank().add('Elysian sigil'), collectionLog: true });
		await user.sync();
		expect(user.bank.amount('Elysian sigil')).toBe(1);
		const historical = (await findBingosWithUserParticipating(user.id)).find(board => board.id === bingo.id)!;
		expect(historical.isActive()).toBe(false);
		expect(historical.determineProgressOfBank(new Bank().add('Elysian sigil')).tilesCompletedCount).toBe(1);
		const participant = await prisma.bingoParticipant.findUniqueOrThrow({
			where: { user_id_bingo_id: { user_id: user.id, bingo_id: bingo.id } }
		});
		expect(participant.cl).toEqual({});
	});
	it.each([
		'theme',
		'configuration'
	] as const)('preserves both settings when a %s confirmation finishes after another organiser edits the board', async firstEdit => {
		const upcoming = await prisma.bingo.update({
			where: { id: bingo.id },
			data: { start_date: new Date(Date.now() + 3_600_000) }
		});
		const replacement = [{ name: 'Coal', oneOf: [itemID('Coal')] }, ...bingo.bingo_tiles.slice(1)];
		const json = JSON.stringify(replacement);
		const configuration: APIAttachment = {
			id: '1111111111111111',
			filename: 'replacement.json',
			size: Buffer.byteLength(json),
			url: 'https://example.com/replacement.json',
			proxy_url: 'https://example.com/replacement.json'
		};
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(json));
		const edits = { theme: { theme: 'summer' as const }, configuration: { configuration } };
		let releaseConfirmation!: () => void;
		let confirmationStarted!: () => void;
		const held = new Promise<void>(resolve => {
			releaseConfirmation = resolve;
		});
		const ready = new Promise<void>(resolve => {
			confirmationStarted = resolve;
		});
		const pending = manageSeasonalBingo(
			new BingoManager(upcoming),
			{
				confirmation: () => {
					confirmationStarted();
					return held;
				}
			} as unknown as MInteraction,
			edits[firstEdit]
		);
		await ready;
		try {
			const current = await prisma.bingo.findUniqueOrThrow({ where: { id: bingo.id } });
			await manageSeasonalBingo(
				new BingoManager(current),
				{ confirmation: async () => {} } as unknown as MInteraction,
				edits[firstEdit === 'theme' ? 'configuration' : 'theme']
			);
		} finally {
			releaseConfirmation();
			await pending;
		}
		const updated = await prisma.bingo.findUniqueOrThrow({ where: { id: bingo.id } });
		expect(updated.theme).toBe('summer');
		expect(updated.bingo_tiles).toEqual(replacement);
	});
	it('returns the team image without exporting JSON in the normal view command', async () => {
		const user = await join();
		const response = await user.runCommand(bingoCommand, { view: { bingo: String(bingo.id) } });
		expect(response).toMatchObject({
			files: [expect.objectContaining({ name: `bingo-${bingo.id}-team-${teamID}.png` })]
		});
	});
	it('keeps quantity items and their earned totals in the items image after their tiles complete', async () => {
		const user = await join();
		const manager = new BingoManager(bingo);
		const image = vi.spyOn(clImageGenerator, 'makeArbitraryCLImage').mockResolvedValue({ files: [] });
		await manager.handleNewItems(user.id, new Bank().add('Redwood logs', 4999).add('Raw dark crab', 9999));
		for (const completed of [false, true]) {
			if (completed) await manager.handleNewItems(user.id, new Bank().add('Redwood logs').add('Raw dark crab'));
			await user.runCommand(bingoCommand, { items: { bingo: String(bingo.id) } });
			const rendered = image.mock.calls.at(-1)![0];
			expect(rendered.clItems.has(itemID('Redwood logs'))).toBe(true);
			expect(rendered.clItems.has(itemID('Raw dark crab'))).toBe(true);
			expect(rendered.userBank.amount('Redwood logs')).toBe(completed ? 5000 : 4999);
			expect(rendered.userBank.amount('Raw dark crab')).toBe(completed ? 10_000 : 9999);
			expect(manager.determineProgressOfBank(rendered.userBank).tilesCompletedCount).toBe(completed ? 2 : 0);
		}
		expect(image).toHaveBeenCalledTimes(2);
	});
	it('requires the organiser-selected team size before finalising a persistent lobby', async () => {
		await prisma.bingo.update({ where: { id: bingo.id }, data: { start_date: new Date(Date.now() + 3_600_000) } });
		const captain = await createTestUser();
		const teammate = await createTestUser();
		const team = await createBingoTeam(bingo.id, captain.id, bingo.guild_id, true);
		await expect(manageBingoTeam(bingo.id, captain.id, 'finalize')).rejects.toThrow('exactly 2 players');
		await joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id);
		await manageBingoTeam(bingo.id, captain.id, 'finalize');
		const members = await prisma.bingoParticipant.findMany({ where: { bingo_id: bingo.id } });
		expect(members.map(p => p.user_id).sort()).toEqual([captain.id, teammate.id].sort());
		expect(new Set(members.map(p => p.bingo_team_id)).size).toBe(1);
		expect((await prisma.bingoTeam.findUniqueOrThrow({ where: { id: team.id } })).players_finalized).toBe(true);
	});

	async function paidLobby() {
		await prisma.bingo.update({
			where: { id: bingo.id },
			data: { start_date: new Date(Date.now() + 3_600_000), ticket_price: 100 }
		});
		await creator.update({ GP: 1000 });
		const teammate = await createTestUser();
		await teammate.update({ GP: 1000 });
		const team = await createBingoTeam(bingo.id, creator.id, bingo.guild_id, true);
		return { teammate, team };
	}

	it('reserves places without charging and atomically charges the roster only once', async () => {
		const { teammate, team } = await paidLobby();
		await joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id);
		const manager = new BingoManager(await prisma.bingo.findUniqueOrThrow({ where: { id: bingo.id } }));
		expect(await manager.countTotalGPInPrizePool()).toBe(0);
		expect((await manager.fetchAllParticipants()).teams).toHaveLength(0);
		await creator.sync();
		expect(creator.GP).toBe(1000);
		const results = await Promise.allSettled([
			manageBingoTeam(bingo.id, creator.id, 'finalize'),
			manageBingoTeam(bingo.id, creator.id, 'finalize')
		]);
		expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
		await Promise.all([creator.sync(), teammate.sync()]);
		expect([creator.GP, teammate.GP]).toEqual([900, 900]);
		expect(await manager.countTotalGPInPrizePool()).toBe(200);
		await manageBingoTeam(bingo.id, creator.id, 'cancel');
		await Promise.all([creator.sync(), teammate.sync()]);
		expect([creator.GP, teammate.GP]).toEqual([1000, 1000]);
	});

	it('never overfills a lobby when players join simultaneously', async () => {
		const { teammate, team } = await paidLobby();
		const other = await createTestUser();
		await other.update({ GP: 1000 });
		const results = await Promise.allSettled(
			[teammate, other].map(player => joinBingoTeam(bingo.id, team.id, player.id, bingo.guild_id))
		);
		expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
		expect(await prisma.bingoParticipant.count({ where: { bingo_team_id: team.id } })).toBe(2);
	});

	it('checks server restrictions even when a valid team ID is supplied directly', async () => {
		const { teammate, team } = await paidLobby();
		const otherGuild = '2222222222222222';
		await expect(joinBingoTeam(bingo.id, team.id, teammate.id, otherGuild)).rejects.toThrow('server');
		await expect(joinBingoTeam(bingo.id, team.id, teammate.id, null)).rejects.toThrow('server');
		await prisma.bingo.update({ where: { id: bingo.id }, data: { is_global: true } });
		await expect(joinBingoTeam(bingo.id, team.id, teammate.id, otherGuild)).rejects.toThrow('server');
		await prisma.bingoTeam.update({ where: { id: team.id }, data: { same_server_only: false } });
		await joinBingoTeam(bingo.id, team.id, teammate.id, otherGuild);
	});

	it('only lets the creator kick players and prevents kicked players rejoining', async () => {
		const { teammate, team } = await paidLobby();
		await joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id);
		await expect(manageBingoTeam(bingo.id, teammate.id, 'kick', creator.id)).rejects.toThrow('not the creator');
		await expect(manageBingoTeam(bingo.id, creator.id, 'kick', creator.id)).rejects.toThrow('yourself');
		await manageBingoTeam(bingo.id, creator.id, 'kick', teammate.id);
		await expect(joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id)).rejects.toThrow('kicked');
		expect(await prisma.bingoParticipant.count({ where: { bingo_team_id: team.id } })).toBe(1);
		await teammate.sync();
		expect(teammate.GP).toBe(1000);
	});

	it('rolls back every charge if a player spends their ticket money before finalisation', async () => {
		const { teammate, team } = await paidLobby();
		await joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id);
		await teammate.update({ GP: 0 });
		await expect(manageBingoTeam(bingo.id, creator.id, 'finalize')).rejects.toThrow('GP');
		await creator.sync();
		expect(creator.GP).toBe(1000);
		expect((await prisma.bingoTeam.findUniqueOrThrow({ where: { id: team.id } })).players_finalized).toBe(false);
		expect(
			await prisma.bingoParticipant.count({ where: { bingo_team_id: team.id, tickets_bought: { gt: 0 } } })
		).toBe(0);
	});

	it('keeps ironmen free and rejects duplicate membership across lobbies', async () => {
		const { teammate, team } = await paidLobby();
		await teammate.update({ minion_ironman: true, GP: 0 });
		await joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id);
		await expect(createBingoTeam(bingo.id, teammate.id, bingo.guild_id, true)).rejects.toThrow('already in a team');
		await manageBingoTeam(bingo.id, creator.id, 'finalize');
		await Promise.all([creator.sync(), teammate.sync()]);
		expect([creator.GP, teammate.GP]).toEqual([900, 0]);
		const manager = new BingoManager(await prisma.bingo.findUniqueOrThrow({ where: { id: bingo.id } }));
		expect(await manager.countTotalGPInPrizePool()).toBe(100);
		await expect(manageBingoTeam(bingo.id, creator.id, 'kick', teammate.id)).rejects.toThrow(
			'already been finalised'
		);
		await manageBingoTeam(bingo.id, creator.id, 'cancel');
		await Promise.all([creator.sync(), teammate.sync()]);
		expect([creator.GP, teammate.GP]).toEqual([1000, 0]);
	});

	it('checks blacklisting again when the roster is finalised', async () => {
		const { teammate, team } = await paidLobby();
		await joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id);
		vi.spyOn(Cache, 'isUserBlacklisted').mockImplementation(async id => id === teammate.id);
		await expect(manageBingoTeam(bingo.id, creator.id, 'finalize')).rejects.toThrow('blacklisted');
		await creator.sync();
		expect(creator.GP).toBe(1000);
		await manageBingoTeam(bingo.id, creator.id, 'kick', teammate.id);
	});

	it('lets players leave unfinished lobbies individually and cancel expired lobbies without refunds', async () => {
		const { teammate, team } = await paidLobby();
		await joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id);
		await leaveBingoTeam(bingo.id, teammate.id);
		expect(await prisma.bingoParticipant.count({ where: { bingo_team_id: team.id } })).toBe(1);
		await prisma.bingo.update({ where: { id: bingo.id }, data: { start_date: new Date(Date.now() - 60_000) } });
		await expect(joinBingoTeam(bingo.id, team.id, teammate.id, bingo.guild_id)).rejects.toThrow(
			'before the bingo starts'
		);
		await expect(manageBingoTeam(bingo.id, creator.id, 'finalize')).rejects.toThrow('before the bingo starts');
		await new BingoManager(await prisma.bingo.findUniqueOrThrow({ where: { id: bingo.id } })).handleNewItems(
			creator.id,
			new Bank().add('Redwood logs', 5000)
		);
		expect((await prisma.bingoParticipant.findFirstOrThrow({ where: { bingo_team_id: team.id } })).cl).toEqual({});
		await manageBingoTeam(bingo.id, creator.id, 'cancel');
		expect(await prisma.bingoTeam.findUnique({ where: { id: team.id } })).toBeNull();
		await creator.sync();
		expect(creator.GP).toBe(1000);
	});
	it('uses a normal bingo for default leaderboard selection and gives a clear empty result', async () => {
		expect((await getBingoFromUserInput(undefined, creator.id))?.id).toBe(bingo.id);
		expect(await creator.runCommand(bingoCommand, { leaderboard: {} })).toContain('has no teams');
	});
});
