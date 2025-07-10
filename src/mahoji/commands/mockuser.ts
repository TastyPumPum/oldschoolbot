import type { CommandRunOptions } from '@oldschoolgg/toolkit/util';
import { ApplicationCommandOptionType } from 'discord.js';

import { createMockUser } from '../../lib/mock/createMockUser';
import type { OSBMahojiCommand } from '../lib/util';

function parseArgs(input: string): { command: string; args: Record<string, any> } {
	const parts = input.split(/\s+/);
	const command = parts.shift()?.toLowerCase() ?? '';
	const args: Record<string, any> = {};
	let i = 0;
	for (const part of parts) {
		if (part.includes(':')) {
			const [key, val] = part.split(':');
			let v: any = val;
			if (val === 'true') v = true;
			else if (val === 'false') v = false;
			else if (!Number.isNaN(Number(val))) v = Number(val);
			args[key] = v;
		} else if (i === 0) {
			args.name = part;
			i++;
		}
	}
	return { command, args };
}

export const mockuserCommand: OSBMahojiCommand = {
	name: 'mockuser',
	description: 'Simulate a minion trip using a mock maxed user.',
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: 'input',
			description: 'Command and args, e.g. "mine granite quantity:1"',
			required: true
		}
	],
	run: async ({ options, userID, channelID }: CommandRunOptions<{ input: string }>) => {
		const { command, args } = parseArgs(options.input);
		const cmd = Array.from(globalClient.mahojiClient.commands.values()).find(c => c.name === command);
		if (!cmd) return `Unknown command: ${command}`;

		const realUser = await mUserFetch(userID);
		const mock = createMockUser(realUser);

		const discordUser = globalClient.users.cache.get(userID) ?? (await globalClient.users.fetch(userID));

		const realMUserFetch = globalThis.mUserFetch;
		globalThis.mUserFetch = async () => mock;

		try {
			return await cmd.run({
				options: args,
				userID,
				channelID,
				client: globalClient.mahojiClient,
				interaction: null as any,
				user: discordUser,
				member: undefined,
				guildID: undefined
			});
		} finally {
			globalThis.mUserFetch = realMUserFetch;
		}
	}
};
