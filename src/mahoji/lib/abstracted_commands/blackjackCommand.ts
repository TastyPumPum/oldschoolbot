import { awaitMessageComponentInteraction, channelIsSendable } from '@oldschoolgg/toolkit/util';
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction
} from 'discord.js';
import { noOp, shuffleArr } from 'e';
import { Bank, Util } from 'oldschooljs';

import { canvasToBuffer, createCanvas, loadAndCacheLocalImage } from '../../../lib/util/canvasUtil';
import { deferInteraction } from '../../../lib/util/interactionReply';
import { mahojiParseNumber, updateClientGPTrackSetting, updateGPTrackSetting } from '../../mahojiSettings';

const cardCache = new Map<string, Promise<import('../../../lib/util/canvasUtil').CanvasImage>>();
const suits = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
const suitSymbols: Record<(typeof suits)[number], string> = {
        spades: '♠',
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣'
};

const MIN_BET = 100_000;
const MAX_BET = 500_000_000;

async function getCardImage(card: string) {
	const [rank, suit] = card === 'BACK' ? ['back', ''] : card.split('_');
	const name = card === 'BACK' ? 'card_back.png' : `card_${suit}_${rank}.png`;
	if (!cardCache.has(name)) cardCache.set(name, loadAndCacheLocalImage(`./src/lib/resources/images/cards/${name}`));
	return cardCache.get(name)!;
}

async function generateBlackjackImage(
	user: MUser,
	hands: string[][],
	dealer: string[],
	hideDealer: boolean,
	active = 0
) {
	const CARD = 64;
	const PAD = 5;
	const TEXT = 18;
	const rows = hands.length + 1;
	const maxCards = Math.max(dealer.length, ...hands.map(h => h.length));
	const canvas = createCanvas(PAD + maxCards * (CARD + PAD), PAD + rows * (CARD + TEXT + PAD));
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	ctx.font = '16px sans-serif';
	ctx.fillStyle = '#ffffff';

	async function drawRow(label: string, cards: string[], y: number, hide = false) {
		ctx.fillText(label, PAD, y + TEXT - 4);
		let x = PAD;
		for (let i = 0; i < cards.length; i++) {
			ctx.drawImage(await getCardImage(hide && i === 1 ? 'BACK' : cards[i]), x, y + TEXT, CARD, CARD);
			x += CARD + PAD;
		}
	}

       await drawRow('Dealer', dealer, PAD, hideDealer);
       for (let i = 0; i < hands.length; i++) {
               await drawRow(
                       hands.length === 1 ? user.badgedUsername : `Hand ${i + 1}${i === active ? '*' : ''}`,
                       hands[i],
                       PAD + (i + 1) * (CARD + TEXT + PAD)
               );
       }

	return new AttachmentBuilder(await canvasToBuffer(canvas), { name: 'blackjack.png' });
}

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
       const deck: string[] = [];
       for (let i = 0; i < 6; i++) {
               for (const r of ranks) {
                       for (const s of suits) {
                               deck.push(`${r}_${s}`);
                       }
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
        for (const card of hand) {
                const [rank] = card.split('_');
                if (rank === 'A') {
                        aces++;
                        value += 11;
                } else if (['J', 'Q', 'K'].includes(rank)) {
                        value += 10;
                } else {
                        value += Number(rank);
                }
        }
        while (value > 21 && aces-- > 0) value -= 10;
        return value;
}

function displayCard(card: string) {
	const [rank, suit] = card.split('_');
	return `${rank}${suitSymbols[suit as keyof typeof suitSymbols]}`;
}

function formatHands(user: MUser, hands: string[][], dealer: string[], hideDealer: boolean, active = 0) {
	const dealerVal = hideDealer ? handValue([dealer[0]]) : handValue(dealer);
	const dealerDisplay = hideDealer ? `${displayCard(dealer[0])}, ?` : dealer.map(displayCard).join(', ');
	let res = `Dealer: ${dealerDisplay} (${dealerVal})`;
	for (let i = 0; i < hands.length; i++) {
		const mark = i === active ? '*' : '';
		res += `\n${hands.length === 1 ? user.badgedUsername : `Hand ${i + 1}${mark}`}: ${hands[i].map(displayCard).join(', ')} (${handValue(hands[i])})`;
	}
	return res;
}

function isPair(hand: string[]) {
	return hand.length === 2 && hand[0].split('_')[0] === hand[1].split('_')[0];
}

export async function blackjackCommand(
	interaction: ChatInputCommandInteraction,
	user: MUser,
	_amount: string | undefined,
	_sidebet?: string
) {
	await deferInteraction(interaction);
	if (interaction.user.bot) return 'Bots cannot gamble.';
       const amountRaw = mahojiParseNumber({ input: _amount, min: MIN_BET, max: MAX_BET });
       if (amountRaw === null) return 'Specify a bet between 100k and 500m.';
       const amount = amountRaw;
       const sideBet = _sidebet ? mahojiParseNumber({ input: _sidebet, min: 1, max: amount }) : undefined;

	if (user.isIronman) return "Ironmen can't gamble.";
        let totalBet = amount + (sideBet || 0);
        if (user.GP < totalBet) return "You don't have enough GP.";

	await user.removeItemsFromBank(new Bank().add('Coins', totalBet));
	const deck = createDeck();
	const hands: string[][] = [[draw(deck), draw(deck)]];
	const bets = [amount];
	const doubled = [false];
	const dealer = [draw(deck), draw(deck)];

	const isBlackjack = (hand: string[]) => {
		const ranks = hand.map(c => c.split('_')[0]);
		return hand.length === 2 && ranks.includes('A') && ranks.some(r => ['10', 'J', 'Q', 'K'].includes(r));
	};

	const playerBlackjack = isBlackjack(hands[0]);
	const dealerBlackjack = isBlackjack(dealer);

	if (playerBlackjack || dealerBlackjack) {
		let payout = 0;
		const resultParts: string[] = [];
		if (playerBlackjack && dealerBlackjack) {
			resultParts.push('Both you and the dealer have blackjack: push.');
			payout = amount;
		} else if (playerBlackjack) {
			payout = amount + Math.floor(amount * 1.5);
			resultParts.push(`Blackjack! You win ${Util.toKMB(payout)}.`);
		} else {
			resultParts.push('Dealer has blackjack, you lose.');
		}

		if (sideBet) {
			const sideBetWin = isPair(hands[0]) ? sideBet * 10 : 0;
			if (sideBetWin) resultParts.push(`Side bet won ${Util.toKMB(sideBetWin)}.`);
			else resultParts.push('Side bet lost.');
			payout += sideBetWin;
		}

		if (payout > 0) await user.addItemsToBank({ items: new Bank().add('Coins', payout), collectionLog: false });
		await updateClientGPTrackSetting('gp_blackjack', payout - totalBet);
		await updateGPTrackSetting('gp_blackjack', payout - totalBet, user);

		const channel = interaction.channel;
		if (channelIsSendable(channel)) {
			await channel.send({
				content: formatHands(user, hands, dealer, false),
				files: [await generateBlackjackImage(user, hands, dealer, false)]
			});
		}

		return { content: resultParts.join('\n') };
	}

	const buildButtons = (canSplit: boolean, canDouble: boolean) =>
		new ActionRowBuilder<ButtonBuilder>().addComponents([
			new ButtonBuilder().setCustomId('HIT').setLabel('Hit').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('STAND').setLabel('Stand').setStyle(ButtonStyle.Secondary),
			...(canDouble
				? [new ButtonBuilder().setCustomId('DOUBLE').setLabel('Double').setStyle(ButtonStyle.Success)]
				: []),
			...(canSplit
				? [new ButtonBuilder().setCustomId('SPLIT').setLabel('Split').setStyle(ButtonStyle.Danger)]
				: [])
		]);

	let activeHand = 0;
	const channel = interaction.channel;
	if (!channelIsSendable(channel)) {
		return 'This channel does not support sending messages.';
	}

        const message = await channel.send({
                content: formatHands(user, hands, dealer, true),
                files: [await generateBlackjackImage(user, hands, dealer, true)],
                components: [buildButtons(isPair(hands[0]) && user.GP >= bets[0], user.GP >= bets[0])]
        });

	while (activeHand < hands.length) {
		const hand = hands[activeHand];
		while (handValue(hand) < 21) {
			const selection = await awaitMessageComponentInteraction({
				message,
				filter: i => i.user.id === user.id,
				time: 15000
			}).catch(() => null);
			if (!selection) {
				await message.reply('⏱️ Timed out, auto-standing.');
				await message.edit({
					content: formatHands(user, hands, dealer, true, activeHand),
					files: [await generateBlackjackImage(user, hands, dealer, true)],
					components: []
				});
				break; // Auto-stand on timeout
			}

			await selection.deferUpdate().catch(noOp);

                        if (selection.customId === 'HIT') {
                                hand.push(draw(deck));
                        } else if (selection.customId === 'DOUBLE' && !doubled[activeHand]) {
                                if (user.GP < bets[activeHand]) {
                                        await selection
                                                .followUp({ content: "You don't have enough GP to double.", ephemeral: true })
                                                .catch(noOp);
                                        continue;
                                }
                                await user.removeItemsFromBank(new Bank().add('Coins', bets[activeHand]));
                                totalBet += bets[activeHand];
                                bets[activeHand] *= 2;
                                hand.push(draw(deck));
                                doubled[activeHand] = true;
                                break;
                        } else if (
                                selection.customId === 'SPLIT' &&
                                hand.length === 2 &&
                                isPair(hand) &&
                                user.GP >= bets[activeHand]
                        ) {
                               await user.removeItemsFromBank(new Bank().add('Coins', bets[activeHand]));
                               totalBet += bets[activeHand];
                               hands[activeHand] = [hand[0], draw(deck)];
                               hands.push([hand[1], draw(deck)]);
                               bets.push(bets[activeHand]);
                               doubled.push(false);
                               await message.edit({
                                       content: formatHands(user, hands, dealer, true, activeHand),
                                       files: [await generateBlackjackImage(user, hands, dealer, true)],
                                       components: [
                                               buildButtons(
                                                       isPair(hands[activeHand]) && user.GP >= bets[activeHand],
                                                       user.GP >= bets[activeHand]
                                               )
                                       ]
                               });
                               continue;
                        } else if (selection.customId === 'STAND') {
                                break;
                        }

                        await message.edit({
                                content: formatHands(user, hands, dealer, true, activeHand),
                                files: [await generateBlackjackImage(user, hands, dealer, true)],
                                components: [buildButtons(false, !doubled[activeHand] && user.GP >= bets[activeHand])]
                        });
		}
		activeHand++;
	}

	while (handValue(dealer) < 17) dealer.push(draw(deck));
	await message.edit({
		content: formatHands(user, hands, dealer, false),
		files: [await generateBlackjackImage(user, hands, dealer, false)],
		components: []
	});

	let payout = 0;
	const resultParts = hands.map((hand, i) => {
		const playerVal = handValue(hand);
		const dealerVal = handValue(dealer);

		if (playerVal > 21) {
			return `Hand ${i + 1}: bust.`;
		}

		if (dealerVal > 21 || playerVal > dealerVal) {
			payout += bets[i] * 2;
			return `Hand ${i + 1}: won ${Util.toKMB(bets[i] * 2)}.`;
		}

		if (playerVal === dealerVal) {
			payout += bets[i];
			return `Hand ${i + 1}: push.`;
		}

		return `Hand ${i + 1}: lost.`;
	});

	if (sideBet) {
		const sideBetWin = isPair(hands[0]) ? sideBet * 10 : 0;
		if (sideBetWin) resultParts.push(`Side bet won ${Util.toKMB(sideBetWin)}.`);
		else resultParts.push('Side bet lost.');
		payout += sideBetWin;
	}

	if (payout > 0) await user.addItemsToBank({ items: new Bank().add('Coins', payout), collectionLog: false });
	await updateClientGPTrackSetting('gp_blackjack', payout - totalBet);
	await updateGPTrackSetting('gp_blackjack', payout - totalBet, user);

	return { content: resultParts.join('\n') };
}
