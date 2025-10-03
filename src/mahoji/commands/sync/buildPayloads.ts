import { ApplicationCommandType, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';

import { convertCommandOptionToAPIOption, type ICommand } from '@/lib/discord/index.js';
import { allCommands } from '@/mahoji/commands/allCommands.js';

export function convertCommandToAPICommand(
        cmd: ICommand
): RESTPostAPIApplicationCommandsJSONBody & { description: string } {
        return {
                type: ApplicationCommandType.ChatInput,
                name: cmd.name,
                description: cmd.description,
                options: cmd.options.map(convertCommandOptionToAPIOption)
        };
}

export function buildPayloadsFromAllCommands({
        isProduction
}: {
        isProduction: boolean;
}): {
        globalPayload: RESTPostAPIApplicationCommandsJSONBody[];
        supportGuildPayload: RESTPostAPIApplicationCommandsJSONBody[];
} {
        if (!isProduction) {
                return {
                        globalPayload: [],
                        supportGuildPayload: allCommands.map(convertCommandToAPICommand)
                };
        }

        const globalPayload = allCommands
                .filter(command => !command.guildID)
                .map(convertCommandToAPICommand);
        const supportGuildPayload = allCommands
                .filter(command => Boolean(command.guildID))
                .map(convertCommandToAPICommand);

        return { globalPayload, supportGuildPayload };
}
