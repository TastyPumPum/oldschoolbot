import { ApplicationCommandOptionType } from 'discord.js';

import { runCommand } from '@/lib/settings/settings';
import type { CommandRunOptions } from 'packages/toolkit/dist/util';
import { createMockUser } from '../../lib/mock/createMockUser';
import type { OSBMahojiCommand } from '../lib/util';

function findCommand(fullCommandName: string) {
	const cmds = Array.from(globalClient.mahojiClient.commands.values());

	for (const cmd of cmds) {
		if (cmd.name === fullCommandName) return { cmd, subcommand: undefined };

		for (const option of cmd.options ?? []) {
			if (
				option.type === ApplicationCommandOptionType.Subcommand &&
				`${cmd.name} ${option.name}` === fullCommandName
			) {
				return { cmd, subcommand: option.name };
			}
			if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
				for (const sub of option.options ?? []) {
					if (
						sub.type === ApplicationCommandOptionType.Subcommand &&
						`${cmd.name} ${option.name} ${sub.name}` === fullCommandName
					) {
						return { cmd, subcommand: `${option.name} ${sub.name}` };
					}
				}
			}
		}
	}

	return null;
}

function prefixMessage(msg: any) {
	if (typeof msg === 'string') {
		return `TESTING: ${msg}`;
	}
	if (typeof msg === 'object' && msg.content) {
		return { ...msg, content: `TESTING: ${msg.content}` };
	}
	return msg;
}

export const mockuserCommand: OSBMahojiCommand = {
	name: 'mockuser',
	description: 'Simulate a minion trip using a mock maxed user.',
	options: [
		{
			type: ApplicationCommandOptionType.String,
			name: 'command',
			description: 'Base command, e.g. "craft"',
			required: true,
			autocomplete: async (value: string) => {
				return Array.from(globalClient.mahojiClient.commands.values())
					.filter(cmd => !['admin', 'testpotato'].includes(cmd.name))
					.filter(cmd => cmd.name.toLowerCase().includes((value ?? '').toLowerCase()))
					.map(cmd => ({ name: cmd.name, value: cmd.name }))
					.slice(0, 25);
			}
		},
		{
			type: ApplicationCommandOptionType.String,
			name: 'subcommand',
			description: 'Subcommand, e.g. "leather"',
			required: false
		}
	],

	run: async ({ options, userID, channelID }: CommandRunOptions<{ command: string; subcommand?: string }>) => {
		const args: Record<string, any> = {};
		if (options.subcommand) args.name = options.subcommand;

		const found = findCommand(options.command);
		if (!found) return `Unknown command: ${options.command}`;

		const { cmd } = found;
		const realUser = await mUserFetch(userID);
		const mock = createMockUser(realUser);
		const discordUser = globalClient.users.cache.get(userID) ?? (await globalClient.users.fetch(userID));

		const realMUserFetch = globalThis.mUserFetch;
		globalThis.mUserFetch = async () => mock;

		const mockInteraction = {
			user: discordUser,
			replied: false,
			deferred: false,
			ephemeral: false,
			reply: async (msg: any) => console.log('[Mock Reply]', prefixMessage(msg)),
			editReply: async (msg: any) => console.log('[Mock EditReply]', prefixMessage(msg)),
			followUp: async (msg: any) => console.log('[Mock FollowUp]', prefixMessage(msg)),
			isRepliable: () => true,
			isChatInputCommand: () => true,
			channelId: channelID,
			guildId: undefined,
			createdTimestamp: Date.now(),
			id: 'mock-interaction-id',
			commandName: cmd.name,
			options: {
				data: [],
				resolved: {}
			},
			deferReply: async () => {
				mockInteraction.deferred = true;
				return Promise.resolve();
			}
		} as any;

		try {
			return await runCommand({
				commandName: cmd.name,
				args: { ...args, mockRun: true },
				user: discordUser,
				channelID,
				member: null,
				isContinue: false,
				bypassInhibitors: true,
				bypassBusyCheck: true,
				guildID: undefined,
				interaction: mockInteraction,
				continueDeltaMillis: null,
				ephemeral: false
			});
		} finally {
			globalThis.mUserFetch = realMUserFetch;
		}
	}
};
