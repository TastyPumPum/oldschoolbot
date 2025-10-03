import { REST, Routes } from 'discord.js';

import { buildPayloadsFromAllCommands } from './buildPayloads.js';

export async function autoSyncOnStartup({
        rest,
        clientId,
        supportGuildId,
        isProduction
}: {
        rest: REST;
        clientId: string;
        supportGuildId: string;
        isProduction: boolean;
}) {
        const { globalPayload, supportGuildPayload } = buildPayloadsFromAllCommands({ isProduction });

        await rest.put(Routes.applicationGuildCommands(clientId, supportGuildId), {
                body: supportGuildPayload
        });

        if (isProduction) {
                await rest.put(Routes.applicationCommands(clientId), {
                        body: globalPayload
                });
                return;
        }

        await rest.put(Routes.applicationCommands(clientId), {
                body: []
        });
}
