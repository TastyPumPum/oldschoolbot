import { awaitMessageComponentInteraction, channelIsSendable } from '@oldschoolgg/toolkit/util';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type ChatInputCommandInteraction } from 'discord.js';
import { noOp, shuffleArr } from 'e';
import { Bank, Util } from 'oldschooljs';

import { deferInteraction } from '../../../lib/util/interactionReply';
import { mahojiParseNumber, updateClientGPTrackSetting, updateGPTrackSetting } from '../../mahojiSettings';

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
	const deck: string[] = [];
	for (let i = 0; i < 6; i++) {
		for (const r of ranks) {
			for (const s of suits) deck.push(`${r}${s}`);
		}
	}
	return shuffleArr(deck);
}

function draw(deck: string[]) {
	return deck.pop()!;
}

function handValue(hand: string[]) {
	let value = 0;
	let aces = 0;
	for (const c of hand) {
		const rank = c.slice(0, -1);
		if (rank === 'A') {
			value += 11;
			aces++;
		} else if (['J', 'Q', 'K'].includes(rank)) {
			value += 10;
		} else {
			value += Number(rank);
		}
	}
	while (value > 21 && aces > 0) {
		value -= 10;
		aces--;
	}
	return value;
}

function formatHands(user: MUser, hands: string[][], dealer: string[], hideDealer: boolean, active = 0) {
	const dealerDisplay = hideDealer ? `${dealer[0]}, ?` : dealer.join(', ');
	const dealerValue = hideDealer ? handValue([dealer[0]]) : handValue(dealer);
	let res = `Dealer: ${dealerDisplay} (${dealerValue})`;
	if (hands.length === 1) {
		const [hand] = hands;
		res += `\n${user.badgedUsername}: ${hand.join(', ')} (${handValue(hand)})`;
	} else {
		for (let i = 0; i < hands.length; i++) {
			const mark = i === active ? '*' : '';
			res += `\nHand ${i + 1}${mark}: ${hands[i].join(', ')} (${handValue(hands[i])})`;
		}
	}
	return res;
}

export async function blackjackCommand(
	interaction: ChatInputCommandInteraction,
	user: MUser,
	_amount: string | undefined,
	_sidebet?: string
) {
	await deferInteraction(interaction);
	if (interaction.user.bot) return 'Bots cannot gamble.';
	const amount = mahojiParseNumber({ input: _amount, min: 1, max: 500_000_000 });
	if (!amount) return 'You must specify an amount between 1 and 500m.';
	const sideBet = _sidebet ? mahojiParseNumber({ input: _sidebet, min: 1, max: amount }) : null;
	if (_sidebet && !sideBet) return 'Invalid sidebet amount.';
	if (user.isIronman) return "Ironmen can't gamble.";
	if (amount < 100_000) return 'Minimum bet is 100k.';
	let totalBet = amount + (sideBet ?? 0);
	if (user.GP < totalBet) return "You don't have enough GP.";

	const channel = globalClient.channels.cache.get(interaction.channelId);
	if (!channelIsSendable(channel)) return 'Invalid channel.';

	await user.removeItemsFromBank(new Bank().add('Coins', totalBet));
	const deck = createDeck();
	const player = [draw(deck), draw(deck)];
	const dealer = [draw(deck), draw(deck)];

	const hands: string[][] = [player];
	const bets: number[] = [amount];
	const doubled: boolean[] = [false];
	let activeHand = 0;

	let canSplit = player[0].slice(0, -1) === player[1].slice(0, -1) && user.GP >= amount;

	const componentsRow = (handIndex: number, allowSplit: boolean) => [
		new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('HIT').setLabel('Hit').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('STAND').setLabel('Stand').setStyle(ButtonStyle.Secondary),
			...(!doubled[handIndex]
				? [new ButtonBuilder().setCustomId('DOUBLE').setLabel('Double Down').setStyle(ButtonStyle.Success)]
				: []),
			...(allowSplit
				? [new ButtonBuilder().setCustomId('SPLIT').setLabel('Split').setStyle(ButtonStyle.Danger)]
				: [])
		])
	];

	const message = await channel.send({
		content: formatHands(user, hands, dealer, true, activeHand),
		components: componentsRow(activeHand, canSplit)
	});

	while (activeHand < hands.length) {
		let playerValue = handValue(hands[activeHand]);
		while (playerValue < 21) {
			const selection = await awaitMessageComponentInteraction({
				message,
				filter: i => i.user.id === user.id,
				time: 15000
			}).catch(() => null);
			if (!selection) {
				await message.edit({ components: [] }).catch(noOp);
				await user.addItemsToBank({ items: new Bank().add('Coins', totalBet), collectionLog: false });
				return 'Blackjack timed out, bet refunded.';
			}

			if (selection.customId === 'HIT') {
				hands[activeHand].push(draw(deck));
				playerValue = handValue(hands[activeHand]);
				await selection.deferUpdate().catch(noOp);
				await message.edit({
					content: formatHands(user, hands, dealer, true, activeHand),
					components: playerValue >= 21 ? [] : componentsRow(activeHand, false)
				});
				if (playerValue >= 21) break;
				continue;
			}

			if (selection.customId === 'DOUBLE') {
				if (user.GP < amount) {
					await selection
						.reply({ ephemeral: true, content: "You don't have enough GP to double down." })
						.catch(noOp);
					continue;
				}
				await selection.deferUpdate().catch(noOp);
				await user.removeItemsFromBank(new Bank().add('Coins', amount));
				totalBet += amount;
				bets[activeHand] += amount;
				doubled[activeHand] = true;
				hands[activeHand].push(draw(deck));
				playerValue = handValue(hands[activeHand]);
				await message.edit({ content: formatHands(user, hands, dealer, true, activeHand), components: [] });
				break;
			}

			if (selection.customId === 'SPLIT' && canSplit && activeHand === 0) {
				if (user.GP < amount) {
					await selection
						.reply({ ephemeral: true, content: "You don't have enough GP to split." })
						.catch(noOp);
					continue;
				}
				await selection.deferUpdate().catch(noOp);
				await user.removeItemsFromBank(new Bank().add('Coins', amount));
				totalBet += amount;
				hands[0] = [player[0], draw(deck)];
				hands.push([player[1], draw(deck)]);
				bets.push(amount);
				doubled.push(false);
				canSplit = false;
				await message.edit({
					content: formatHands(user, hands, dealer, true, activeHand),
					components: componentsRow(activeHand, false)
				});
				playerValue = handValue(hands[activeHand]);
				continue;
			}

			if (selection.customId === 'STAND') {
				await selection.deferUpdate().catch(noOp);
				break;
			}
		}

		activeHand++;
		if (activeHand < hands.length) {
			await message.edit({
				content: formatHands(user, hands, dealer, true, activeHand),
				components: componentsRow(activeHand, false)
			});
		}
	}

	let dealerValue = handValue(dealer);
	while (dealerValue < 17) {
		dealer.push(draw(deck));
		dealerValue = handValue(dealer);
	}

	await message.edit({ content: formatHands(user, hands, dealer, false), components: [] }).catch(noOp);

	let payout = 0;
	const resultParts: string[] = [];
	for (let i = 0; i < hands.length; i++) {
		const value = handValue(hands[i]);
		if (value > 21) {
			resultParts.push(`Hand ${i + 1}: bust.`);
			continue;
		}
		if (dealerValue > 21 || value > dealerValue) {
			const won = bets[i] * 2;
			payout += won;
			resultParts.push(`Hand ${i + 1}: won ${Util.toKMB(won)}.`);
		} else if (value === dealerValue) {
			payout += bets[i];
			resultParts.push(`Hand ${i + 1}: push.`);
		} else {
			resultParts.push(`Hand ${i + 1}: lost.`);
		}
	}

	let sideBetPayout = 0;
	if (sideBet && player[0].slice(0, -1) === player[1].slice(0, -1)) {
		sideBetPayout = sideBet * 10;
	}

	const totalPayout = payout + sideBetPayout;
	if (totalPayout > 0) {
		await user.addItemsToBank({ items: new Bank().add('Coins', totalPayout), collectionLog: false });
	}
	await updateClientGPTrackSetting('gp_blackjack', totalPayout - totalBet);
	await updateGPTrackSetting('gp_blackjack', totalPayout - totalBet, user);

	if (sideBet) {
		resultParts.push(sideBetPayout > 0 ? `Side bet won ${Util.toKMB(sideBetPayout)}.` : 'Side bet lost.');
	}

	return { content: resultParts.join('\n') };
}
