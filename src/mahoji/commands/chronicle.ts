import { chronicleCaption, generateChronicleCard } from '@/lib/chronicle.js';
import { PerkTier } from '@/lib/constants.js';

const upsellMessage =
	'📜 Chronicles are a Tier 3 perk. Upgrade to Tier 3 to generate your shareable recap card.\nOne recap image (monthly/season/30d), themes, optional privacy mode.';

export const chronicleCommand = defineCommand({
	name: 'chronicle',
	description: 'Generate a shareable recap card for your recent progress.',
	options: [
		{
			type: 'String',
			name: 'period',
			description: 'The period to generate your recap from.',
			required: true,
			choices: [
				{ name: 'Last 30 Days', value: 'last30days' },
				{ name: 'Monthly', value: 'monthly' },
				{ name: 'Season', value: 'season' }
			]
		},
		{
			type: 'String',
			name: 'style',
			description: 'Visual style for your card.',
			required: false,
			choices: [
				{ name: 'Dark', value: 'dark' },
				{ name: 'Light', value: 'light' },
				{ name: 'Retro Rune', value: 'retroRune' },
				{ name: 'Minimal', value: 'minimal' }
			]
		},
		{
			type: 'Boolean',
			name: 'privacy',
			description: 'If enabled, GP values are shown as ranges.',
			required: false
		}
	],
	run: async ({ user, options }) => {
		const perkTier = await user.fetchPerkTier();
		if (perkTier < PerkTier.Three) {
			return upsellMessage;
		}

		const period = options.period;
		const style = options.style ?? 'dark';
		const privacy = Boolean(options.privacy);

		const result = await generateChronicleCard({ user, period, style, privacy });
		if ('cooldownMessage' in result) {
			return result.cooldownMessage;
		}

		return {
			content: chronicleCaption(user.username, result.stats),
			files: [{ name: 'chronicle.png', buffer: result.buffer }]
		};
	}
});
