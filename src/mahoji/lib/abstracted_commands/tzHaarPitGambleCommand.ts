import { ButtonBuilder, ButtonStyle, SpecialResponse } from '@oldschoolgg/discord';
import { cryptoRng } from '@oldschoolgg/rng/crypto';
import { toKMB } from 'oldschooljs';
import { chunk } from 'remeda';

import { setPitState } from '@/mahoji/lib/abstracted_commands/tzHaarPitGambleState.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const PIT_PREFIX = 'TZHAAR_PIT|';

const CONFIRM_ID = `${PIT_PREFIX}CONFIRM`;
const CANCEL_ID = `${PIT_PREFIX}CANCEL`;

interface PitTile {
	kind: 'safe' | 'lava';
	revealed: boolean;
}

function buildTiles(): PitTile[] {
	const safeTiles = Array.from({ length: 5 }, () => ({ kind: 'safe', revealed: false }) satisfies PitTile);
	const lavaTiles = Array.from({ length: 6 }, () => ({ kind: 'lava', revealed: false }) satisfies PitTile);
	return cryptoRng.shuffle([...safeTiles, ...lavaTiles]);
}

function renderConfirmButtons() {
	return [
		[
			new ButtonBuilder().setCustomId(CONFIRM_ID).setStyle(ButtonStyle.Success).setLabel('Confirm'),
			new ButtonBuilder().setCustomId(CANCEL_ID).setStyle(ButtonStyle.Danger).setLabel('Cancel')
		]
	];
}

// Optional: show tiles (not necessary at confirm stage, but handy if you want consistent renderer later)
function renderTilesPreview() {
	const buttons = Array.from({ length: 11 }, (_, i) =>
		new ButtonBuilder()
			.setCustomId(`${PIT_PREFIX}TILE|${i}`)
			.setStyle(ButtonStyle.Secondary)
			.setLabel('???')
			.setDisabled(true)
	);
	return chunk(buttons, 4).map(row => [...row]) as ButtonBuilder[][];
}

export async function tzHaarPitGambleCommand(
	user: MUser,
	interaction: MInteraction,
	betInput: string | undefined
): Promise<string | SpecialResponse> {
	const amount = mahojiParseNumber({ input: betInput, min: 1_000_000, max: 1_000_000_000 });
	if (!amount) return 'Your bet must be between 1,000,000 and 1,000,000,000.';
	if (user.isIronman) return "Ironmen can't gamble! Go pickpocket some men for GP.";
	if (user.GP < amount) return "You don't have enough GP to make this bet.";

	const response = await interaction.replyWithResponse({
		content: `${user}, step into the TzHaar Pit for **${toKMB(amount)}**?\nLava tiles wipe the entire stake.`,
		components: [...renderConfirmButtons(), ...renderTilesPreview()],
		withResponse: true
	});

	if (!response?.message_id) {
		return 'Something went wrong starting the pit run.';
	}

	const now = Date.now();
	setPitState({
		messageId: response.message_id,
		userId: interaction.userId,
		amount,
		phase: 'confirm',
		tiles: buildTiles(),
		createdAt: now,
		expiresAt: now + 2 * 60_000
	});

	return SpecialResponse.RespondedManually;
}
