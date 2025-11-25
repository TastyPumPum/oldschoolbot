import { globalConfig, PerkTier } from '@/lib/constants.js';
import {
	PATRON_SOUNDTRACK_MIN_TRIP_DURATION_MS,
	PATRON_SOUNDTRACK_THEMES,
	patronSoundtrackThemeLabel
} from '@/lib/patronSoundtrack/patronSoundtrack.js';
import { patronMsg } from '@/lib/util/smallUtils.js';

const MIN_TRIP_MINUTES = PATRON_SOUNDTRACK_MIN_TRIP_DURATION_MS / (60 * 1000);

export const soundtrackCommand = defineCommand({
	name: 'soundtrack',
	description: 'Toggle the patron mini soundtrack ambience that plays after long trips.',
	options: [
		{
			type: 'Boolean',
			name: 'enable',
			description: 'Enable or disable the ambience clip.',
			required: true
		},
		{
			type: 'String',
			name: 'theme',
			description: 'Pick the ambience theme you want to hear.',
			required: false,
			choices: PATRON_SOUNDTRACK_THEMES.map(theme => ({
				name: patronSoundtrackThemeLabel(theme),
				value: theme
			}))
		}
	],
	run: async ({ options, user }) => {
		if (!globalConfig.patronSoundtracksEnabled) {
			return 'The patron mini soundtrack feature is currently disabled.';
		}

		const perkTier = await user.fetchPerkTier();
		if (perkTier < PerkTier.One) {
			return patronMsg(PerkTier.One);
		}

		const theme = options.theme as (typeof PATRON_SOUNDTRACK_THEMES)[number] | undefined;
		if (options.enable && (!theme || !PATRON_SOUNDTRACK_THEMES.includes(theme))) {
			return 'You need to pick a valid theme to enable the mini soundtrack.';
		}

		await user.update({
			patron_soundtrack_enabled: options.enable,
			patron_soundtrack_theme: options.enable ? theme : null,
			patron_soundtrack_last_played: options.enable ? user.user.patron_soundtrack_last_played : null
		});

		if (options.enable) {
			const selectedTheme = theme!;
			return `Patron ambience enabled with the ${patronSoundtrackThemeLabel(selectedTheme)} theme. A short clip will play after trips lasting at least ${MIN_TRIP_MINUTES} minutes when you're in a voice channel.`;
		}

		return 'Patron ambience has been disabled. No clips will play after your trips.';
	}
});
