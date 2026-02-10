import {
	ButtonBuilder,
	type ButtonMInteraction,
	ButtonStyle,
	EmbedBuilder,
	SpecialResponse
} from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank, toKMB } from 'oldschooljs';

import { BitField } from '@/lib/constants.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const RPS_TIMEOUT_MS = Time.Second * 90;

type RPSChoice = 'rock' | 'paper' | 'scissors';
type RPSStatus = 'awaiting_acceptance' | 'pending' | 'complete' | 'cancelled';

type RPSMatch = {
	id: string;
	channelId: string;
	messageId: string | null;
	player1Id: string;
	player2Id: string;
	p1Choice?: RPSChoice;
	p2Choice?: RPSChoice;
	stake: number;
	createdAt: number;
	status: RPSStatus;
};

const rpsMatches = new Map<string, RPSMatch>();

const RPS_CHOICES: { key: RPSChoice; emoji: string; label: string }[] = [
	{ key: 'rock', emoji: '🪨', label: 'Rock' },
	{ key: 'paper', emoji: '📄', label: 'Paper' },
	{ key: 'scissors', emoji: '✂️', label: 'Scissors' }
];

function getRPSButtons(matchId: string, disabled = false): ButtonBuilder[][] {
	const choiceButtons = RPS_CHOICES.map(choice =>
		new ButtonBuilder()
			.setCustomId(`rps:${matchId}:${choice.key}`)
			.setLabel(choice.label)
			.setEmoji({ name: choice.emoji })
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(disabled)
	);

	const cancelButton = new ButtonBuilder()
		.setCustomId(`rps:${matchId}:cancel`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Danger)
		.setDisabled(disabled);

	return [[...choiceButtons, cancelButton]];
}

function getChallengeButtons(matchId: string, disabled = false): ButtonBuilder[][] {
	const acceptButton = new ButtonBuilder()
		.setCustomId(`rps:${matchId}:accept`)
		.setLabel('Accept')
		.setStyle(ButtonStyle.Success)
		.setDisabled(disabled);

	const declineButton = new ButtonBuilder()
		.setCustomId(`rps:${matchId}:decline`)
		.setLabel('Decline')
		.setStyle(ButtonStyle.Danger)
		.setDisabled(disabled);

	const cancelButton = new ButtonBuilder()
		.setCustomId(`rps:${matchId}:cancel`)
		.setLabel('Cancel')
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(disabled);

	return [[acceptButton, declineButton, cancelButton]];
}

function getChoiceData(choice: RPSChoice) {
	return RPS_CHOICES.find(i => i.key === choice)!;
}

function getChoiceForUser(match: RPSMatch, userId: string) {
	if (userId === match.player1Id) return match.p1Choice;
	if (userId === match.player2Id) return match.p2Choice;
	return null;
}

function setChoiceForUser(match: RPSMatch, userId: string, choice: RPSChoice) {
	if (userId === match.player1Id) match.p1Choice = choice;
	if (userId === match.player2Id) match.p2Choice = choice;
}

function getWinner(match: RPSMatch) {
	if (!match.p1Choice || !match.p2Choice) return null;
	if (match.p1Choice === match.p2Choice) return null;

	if (
		(match.p1Choice === 'rock' && match.p2Choice === 'scissors') ||
		(match.p1Choice === 'paper' && match.p2Choice === 'rock') ||
		(match.p1Choice === 'scissors' && match.p2Choice === 'paper')
	) {
		return match.player1Id;
	}
	return match.player2Id;
}

function getReadinessLine(playerName: string, locked: boolean) {
	return `${playerName}: ${locked ? '✅ locked' : '⏳ choosing…'}`;
}

async function createMatchEmbed({
	match,
	player1Name,
	player2Name,
	title,
	description,
	showReveal = false
}: {
	match: RPSMatch;
	player1Name: string;
	player2Name: string;
	title?: string;
	description?: string;
	showReveal?: boolean;
}) {
	const lines = [
		getReadinessLine(player1Name, Boolean(match.p1Choice)),
		getReadinessLine(player2Name, Boolean(match.p2Choice))
	];

	if (match.stake > 0) {
		lines.push(`Stake: ${toKMB(match.stake)} GP`);
	}

	if (showReveal && match.p1Choice && match.p2Choice) {
		const p1 = getChoiceData(match.p1Choice);
		const p2 = getChoiceData(match.p2Choice);
		lines.push('');
		lines.push(`${player1Name} picked ${p1.emoji} ${p1.label}`);
		lines.push(`${player2Name} picked ${p2.emoji} ${p2.label}`);
	}

	return new EmbedBuilder()
		.setTitle(title ?? 'Rock Paper Scissors')
		.setDescription([description, ...lines].filter(Boolean).join('\n'));
}

async function checkCanAffordStake(user: MUser, stake: number) {
	if (stake <= 0) return true;
	return user.GP >= stake;
}

async function settleStake({
	winner,
	loser,
	stake,
	guildId
}: {
	winner: MUser;
	loser: MUser;
	stake: number;
	guildId: string | null;
}) {
	if (stake <= 0) return;

	const cost = new Bank().add('Coins', stake);
	await Promise.all([winner.sync(), loser.sync()]);

	if (winner.GP < stake || loser.GP < stake) {
		throw new Error('One player can no longer afford the stake.');
	}

	await Promise.all([winner.removeItemsFromBank(cost), loser.removeItemsFromBank(cost)]);
	await winner.addItemsToBank({ items: new Bank().add('Coins', stake * 2), collectionLog: false });

	await prisma.economyTransaction.create({
		data: {
			guild_id: guildId ? BigInt(guildId) : null,
			sender: BigInt(loser.id),
			recipient: BigInt(winner.id),
			items_sent: cost.toJSON(),
			type: 'duel'
		}
	});
}

export async function rpsCommand({
	interaction,
	user,
	opponentID,
	opponentIsBot,
	guildId,
	stakeInput
}: {
	interaction: MInteraction;
	user: MUser;
	opponentID: string;
	opponentIsBot: boolean;
	guildId: string | null;
	stakeInput?: string;
}) {
	if (user.id === opponentID) return 'You cannot challenge yourself.';
	if (opponentIsBot) return 'You cannot challenge a bot.';

	const opponent = await mUserFetch(opponentID);

	const parsedStake = stakeInput ? mahojiParseNumber({ input: stakeInput, min: 1, max: 500_000_000_000 }) : null;

	if (stakeInput && parsedStake === null) return 'Invalid stake amount.';
	const stake = parsedStake ?? 0;

	if (
		stake > 0 &&
		(user.bitfield.includes(BitField.SelfGamblingLocked) || opponent.bitfield.includes(BitField.SelfGamblingLocked))
	) {
		return 'One of you has gambling disabled and cannot participate in this match.';
	}

	if (!(await checkCanAffordStake(user, stake))) return `You cannot afford a ${toKMB(stake)} GP stake.`;
	if (!(await checkCanAffordStake(opponent, stake))) {
		return `${opponent.usernameOrMention} cannot afford a ${toKMB(stake)} GP stake.`;
	}

	const matchId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	const [player1Name, player2Name] = await Cache.getBadgedUsernames([user.id, opponent.id]);

	const match: RPSMatch = {
		id: matchId,
		channelId: interaction.channelId,
		messageId: null,
		player1Id: user.id,
		player2Id: opponent.id,
		stake,
		createdAt: Date.now(),
		status: 'awaiting_acceptance'
	};

	rpsMatches.set(match.id, match);

	await interaction.defer();
	const initial = await interaction.replyWithResponse({
		embeds: [
			await createMatchEmbed({
				match,
				player1Name,
				player2Name,
				description: `${opponent} do you accept this Rock Paper Scissors challenge${stake > 0 ? ` for ${toKMB(stake)} GP` : ''}?`
			})
		],
		components: getChallengeButtons(match.id)
	});

	match.messageId = initial?.message_id ?? null;

	const collector = globalClient.createInteractionCollector({
		interaction,
		timeoutMs: RPS_TIMEOUT_MS,
		maxCollected: Infinity,
		filter: i => {
			const customId = i.customId;
			if (!customId) return false;
			if (!customId.startsWith(`rps:${match.id}:`)) return false;
			if (![match.player1Id, match.player2Id].includes(i.userId)) return false;
			if (!rpsMatches.has(match.id) || (match.status !== 'pending' && match.status !== 'awaiting_acceptance')) {
				return false;
			}
			return true;
		}
	});

	collector.on('collect', async (buttonInteraction: ButtonMInteraction) => {
		const currentMatch = rpsMatches.get(match.id);
		if (!currentMatch || currentMatch.status === 'cancelled' || currentMatch.status === 'complete') {
			// can't update a dead match, so just ephemeral reply
			await buttonInteraction.reply({ content: 'This match has expired.', ephemeral: true });
			return;
		}

		if (![currentMatch.player1Id, currentMatch.player2Id].includes(buttonInteraction.userId)) {
			await buttonInteraction.reply({ content: 'Not your match.', ephemeral: true });
			return;
		}

		const customId = buttonInteraction.customId;
		if (!customId) {
			await buttonInteraction.reply({ content: 'Invalid interaction.', ephemeral: true });
			return;
		}

		const [, incomingMatchID, action] = customId.split(':');
		if (incomingMatchID !== currentMatch.id || !action) {
			await buttonInteraction.reply({ content: 'Invalid match action.', ephemeral: true });
			return;
		}

		if (currentMatch.status === 'awaiting_acceptance') {
			if (action === 'accept') {
				if (buttonInteraction.userId !== currentMatch.player2Id) {
					await buttonInteraction.reply({
						content: 'Only the challenged player can accept.',
						ephemeral: true
					});
					return;
				}

				currentMatch.status = 'pending';
				currentMatch.createdAt = Date.now();

				await buttonInteraction.update({
					embeds: [
						await createMatchEmbed({
							match: currentMatch,
							player1Name,
							player2Name,
							description: `Match expires in ${formatDuration(RPS_TIMEOUT_MS)}.`
						})
					],
					components: getRPSButtons(match.id)
				});

				await buttonInteraction.followUp({ content: 'Challenge accepted. Choose your move!', ephemeral: true });
				return;
			}

			if (action === 'decline') {
				if (buttonInteraction.userId !== currentMatch.player2Id) {
					await buttonInteraction.reply({
						content: 'Only the challenged player can decline.',
						ephemeral: true
					});
					return;
				}

				currentMatch.status = 'cancelled';

				await buttonInteraction.update({
					embeds: [
						await createMatchEmbed({
							match: currentMatch,
							player1Name,
							player2Name,
							title: 'Rock Paper Scissors — Declined',
							description: `${opponent} declined the challenge.`
						})
					],
					components: getChallengeButtons(match.id, true)
				});

				rpsMatches.delete(match.id);
				collector.stop('cancelled');
				return;
			}
		}

		// Cancel
		if (action === 'cancel') {
			if (buttonInteraction.userId !== currentMatch.player1Id) {
				await buttonInteraction.reply({
					content: 'Only the challenger can cancel this match.',
					ephemeral: true
				});
				return;
			}

			const wasAwaitingAcceptance = currentMatch.status === 'awaiting_acceptance';
			currentMatch.status = 'cancelled';

			await buttonInteraction.update({
				embeds: [
					await createMatchEmbed({
						match: currentMatch,
						player1Name,
						player2Name,
						title: 'Rock Paper Scissors — Cancelled'
					})
				],
				components: wasAwaitingAcceptance ? getChallengeButtons(match.id, true) : getRPSButtons(match.id, true)
			});

			// Optional private confirmation
			await buttonInteraction.followUp({ content: 'Cancelled.', ephemeral: true });

			rpsMatches.delete(match.id);
			collector.stop('cancelled');
			return;
		}

		// Validate action
		if (action !== 'rock' && action !== 'paper' && action !== 'scissors') {
			await buttonInteraction.reply({ content: 'Invalid action.', ephemeral: true });
			return;
		}

		if (currentMatch.status !== 'pending') {
			await buttonInteraction.reply({ content: 'This challenge has not been accepted yet.', ephemeral: true });
			return;
		}

		// Lock on first click
		const existingChoice = getChoiceForUser(currentMatch, buttonInteraction.userId);
		if (existingChoice) {
			await buttonInteraction.reply({ content: "You're already locked in.", ephemeral: true });
			return;
		}

		const choice = action as RPSChoice;
		setChoiceForUser(currentMatch, buttonInteraction.userId, choice);

		const bothLocked = Boolean(currentMatch.p1Choice && currentMatch.p2Choice);

		// If not both locked yet, update readiness only
		if (!bothLocked) {
			await buttonInteraction.update({
				embeds: [
					await createMatchEmbed({
						match: currentMatch,
						player1Name,
						player2Name,
						description: `Match expires in ${formatDuration(
							Math.max(0, RPS_TIMEOUT_MS - (Date.now() - currentMatch.createdAt))
						)}.`
					})
				],
				components: getRPSButtons(match.id)
			});

			// Private lock confirmation
			const choiceData = getChoiceData(choice);
			await buttonInteraction.followUp({ content: `✅ Locked in: ${choiceData.label}`, ephemeral: true });
			return;
		}

		// Both locked -> settle + reveal
		currentMatch.status = 'complete';

		const winnerID = getWinner(currentMatch);
		let resultLine = "It's a tie!";

		if (winnerID) {
			const winner = winnerID === user.id ? user : opponent;
			const loser = winnerID === user.id ? opponent : user;

			try {
				await settleStake({ winner, loser, stake: currentMatch.stake, guildId });
				resultLine =
					currentMatch.stake > 0
						? `✅ ${winner} wins +${toKMB(currentMatch.stake)} GP`
						: `✅ ${winner} wins!`;
			} catch {
				resultLine = `✅ ${winner} wins, but stake settlement failed because one player could no longer afford the stake.`;
			}
		}

		await buttonInteraction.update({
			embeds: [
				await createMatchEmbed({
					match: currentMatch,
					player1Name,
					player2Name,
					title: 'Rock Paper Scissors — Result',
					description: resultLine,
					showReveal: true
				})
			],
			components: getRPSButtons(match.id, true)
		});

		// Optional private confirmation for the click that completed the match
		const choiceData = getChoiceData(choice);
		await buttonInteraction.followUp({ content: `✅ Locked in: ${choiceData.label}`, ephemeral: true });

		rpsMatches.delete(match.id);
		collector.stop('complete');
	});

	collector.once('end', async (_, reason) => {
		if (reason === 'complete' || reason === 'cancelled') return;

		const currentMatch = rpsMatches.get(match.id);
		if (!currentMatch || currentMatch.status === 'cancelled' || currentMatch.status === 'complete') return;

		const wasAwaitingAcceptance = currentMatch.status === 'awaiting_acceptance';
		currentMatch.status = 'cancelled';

		const anyInteraction = interaction as any;

		if (typeof anyInteraction.edit === 'function') {
			await anyInteraction.edit({
				embeds: [
					await createMatchEmbed({
						match: currentMatch,
						player1Name,
						player2Name,
						title: 'Rock Paper Scissors — Timed Out',
						description: wasAwaitingAcceptance
							? 'Timed out before the challenge was accepted.'
							: 'Timed out before both players locked in.'
					})
				],
				components: wasAwaitingAcceptance ? getChallengeButtons(match.id, true) : getRPSButtons(match.id, true)
			});
		}

		rpsMatches.delete(match.id);
	});

	return SpecialResponse.RespondedManually;
}
