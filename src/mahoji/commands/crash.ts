import { choicesOf } from '@/discord/index.js';
import { crashCommand } from '@/mahoji/lib/abstracted_commands/crashCommand.js';

export const crashCommandDefinition = defineCommand({
	name: 'crash',
	flags: ['REQUIRES_LOCK'],
	description: 'Wager GP in crash and auto cashout at your chosen multiplier.',
	options: [
		{
			type: 'String',
			name: 'amount',
			description: 'Amount you wish to gamble.',
			required: true
		},
		{
			type: 'String',
			name: 'auto',
			description: 'Auto cashout multiplier (e.g. 2, 2x, 2.25).',
			required: true
		},
		{
			type: 'String',
			name: 'risk',
			description: 'Adjusts volatility of crash points.',
			required: false,
			choices: choicesOf(['low', 'med', 'high'])
		}
	],
	run: async ({ options, user, rng }) => {
		return crashCommand(rng, user, options.auto, options.amount, options.risk);
	}
});
