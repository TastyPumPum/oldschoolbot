import { ButtonBuilder, ButtonStyle } from '@oldschoolgg/discord';
import { Bank } from 'oldschooljs';

import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { BitField, MAX_CLUES_DROPPED } from '@/lib/constants.js';
import { EmojiId } from '@/lib/data/emojis.js';
import { InteractionID } from '@/lib/InteractionID.js';

export function getClueScoresFromOpenables(openableScores: Bank) {
	return openableScores.filter(item => Boolean(ClueTiers.find(ct => ct.id === item.id)));
}

export function deduplicateClueScrolls(bank: Bank) {
	const theirClues = new Bank();
	let cluesLeftWeCanGive = MAX_CLUES_DROPPED;
	for (let i = ClueTiers.length; i > 0; i--) {
		if (cluesLeftWeCanGive <= 0) {
			break;
		}
		const tier = ClueTiers[i - 1];
		const qtyToAdd = Math.min(cluesLeftWeCanGive, bank.amount(tier.scrollID));
		theirClues.add(tier.scrollID, qtyToAdd);
		cluesLeftWeCanGive -= qtyToAdd;
		if (
			theirClues
				.items()
				.map(_i => _i[1])
				.reduce((a, b) => a + b, 0) > MAX_CLUES_DROPPED
		) {
			break;
		}
	}

	for (const tier of ClueTiers) bank.set(tier.scrollID, 0);
	for (const [itemID, qty] of theirClues.items()) bank.set(itemID, qty);
}

const clueDoInteractionIdByTier: Record<string, string> = {
	beginner: InteractionID.Commands.DoBeginnerClue,
	easy: InteractionID.Commands.DoEasyClue,
	medium: InteractionID.Commands.DoMediumClue,
	hard: InteractionID.Commands.DoHardClue,
	elite: InteractionID.Commands.DoEliteClue,
	master: InteractionID.Commands.DoMasterClue
};

export function getDoClueInteractionId(tierName: string): string {
	return clueDoInteractionIdByTier[tierName.toLowerCase()] ?? InteractionID.Commands.DoBeginnerClue;
}

export function buildClueButtons(loot: Bank | null, perkTier: number, user: MUser) {
	const components: ButtonBuilder[] = [];
	if (loot && perkTier > 1 && !user.bitfield.includes(BitField.DisableClueButtons)) {
		const clueReceived = ClueTiers.filter(tier => loot.amount(tier.scrollID) > 0);
		components.push(
			...clueReceived.map(clue =>
				new ButtonBuilder()
					.setCustomId(getDoClueInteractionId(clue.name))
					.setLabel(`Do ${clue.name} Clue`)
					.setStyle(ButtonStyle.Secondary)
					.setEmoji({ id: EmojiId.ClueScroll })
			)
		);
	}
	return components;
}
