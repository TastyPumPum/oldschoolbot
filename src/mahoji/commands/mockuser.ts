import { ApplicationCommandOptionType } from 'discord.js';

import { runCommand } from '@/lib/settings/settings';
import { createMockUser } from '../../lib/mock/createMockUser';
import type { OSBMahojiCommand } from '../lib/util';
import { channelIsSendable, type CommandRunOptions } from 'packages/toolkit/dist/util';

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
					.filter(cmd => !['admin', 'testpotato', 'mockuser'].includes(cmd.name))
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

	run: async ({
		options,
		userID,
		channelID,
		interaction
	}: CommandRunOptions<{ command: string; subcommand?: string }>) => {
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

		// Use the actual interaction or fallback to sending messages directly to the channel
		const sendReply = async (msg: any) => {
			const message =
				typeof msg === 'string'
					? { content: `TESTING: ${msg}`, ephemeral: false }
					: { ...msg, content: `TESTING: ${msg.content}`, ephemeral: false };

			if (interaction) {
				if (!mockInteraction.replied) {
					mockInteraction.replied = true;
					return interaction.reply(message).catch(() => {});
				}
				return interaction.followUp(message).catch(() => {});
			}

			const channel = globalClient.channels.cache.get(channelID);
			if (channelIsSendable(channel)) {
				return channel.send(message);
			}
			console.warn(`Cannot send message to channel ${channelID} because it is not text-based.`);
		};

		const mockInteraction = {
			user: discordUser,
			replied: false,
			deferred: false,
			ephemeral: false,
			reply: sendReply,
			editReply: sendReply,
			followUp: sendReply,
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
				args,
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
