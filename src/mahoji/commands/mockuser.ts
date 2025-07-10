import { ApplicationCommandOptionType } from 'discord.js';

import type { CommandRunOptions } from 'packages/toolkit/dist/util';
import { createMockUser } from '../../lib/mock/createMockUser';
import type { OSBMahojiCommand } from '../lib/util';

function parseArgs(input: string): { command: string; args: Record<string, any> } {
	const parts = input.split(/\s+/);
	const args: Record<string, any> = {};
	const commandParts: string[] = [];

	for (const part of parts) {
		if (part.includes(':')) {
			const [key, val] = part.split(':');
			let v: any = val;
			if (val === 'true') v = true;
			else if (val === 'false') v = false;
			else if (!Number.isNaN(Number(val))) v = Number(val);
			args[key] = v;
		} else {
			commandParts.push(part.toLowerCase());
		}
	}

	return { command: commandParts.join(' '), args };
}

function findCommand(fullCommandName: string) {
	const cmds = Array.from(globalClient.mahojiClient.commands.values());

	for (const cmd of cmds) {
		if (cmd.name === fullCommandName) return cmd;

		for (const option of cmd.options ?? []) {
			if (
				option.type === ApplicationCommandOptionType.Subcommand &&
				`${cmd.name} ${option.name}` === fullCommandName
			) {
				return cmd;
			}
			if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
				for (const sub of option.options ?? []) {
					if (
						sub.type === ApplicationCommandOptionType.Subcommand &&
						`${cmd.name} ${option.name} ${sub.name}` === fullCommandName
					) {
						return cmd;
					}
				}
			}
		}
	}

	return null;
}

export const mockuserCommand: OSBMahojiCommand = {
	name: 'mockuser',
	description: 'Simulate a minion trip using a mock maxed user.',
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: 'input',
			description: 'Command and args, e.g. "mine granite quantity:1"',
			required: true,
			autocomplete: async (value: string) => {
				const cmds = Array.from(globalClient.mahojiClient.commands.values());
				const results: { name: string; value: string }[] = [];

				for (const cmd of cmds) {
					// Add base command
					results.push({ name: cmd.name, value: cmd.name });

					// Handle subcommands and subcommand groups
					for (const option of cmd.options ?? []) {
						if (option.type === ApplicationCommandOptionType.Subcommand) {
							results.push({ name: `${cmd.name} ${option.name}`, value: `${cmd.name} ${option.name}` });
						} else if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
							for (const subOption of option.options ?? []) {
								if (subOption.type === ApplicationCommandOptionType.Subcommand) {
									results.push({
										name: `${cmd.name} ${option.name} ${subOption.name}`,
										value: `${cmd.name} ${option.name} ${subOption.name}`
									});
								}
							}
						}
					}
				}
				return results
					.filter(res => res.value.toLowerCase().includes((value ?? '').toLowerCase()))
					.slice(0, 25);
			}
		}
	],
	run: async ({ options, userID, channelID }: CommandRunOptions<{ input: string }>) => {
		const { command, args } = parseArgs(options.input);

		const cmd = findCommand(command);
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
				guildID: undefined,
				bypassBusyCheck: mock.isMock
			});
		} finally {
			globalThis.mUserFetch = realMUserFetch;
		}
	}
};
