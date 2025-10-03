import { REST, Routes } from 'discord.js';

let installed = false;

export function installGracefulShutdown({
        rest,
        clientId,
        supportGuildId,
        isProduction: _isProduction
}: {
        rest: REST;
        clientId: string;
        supportGuildId: string;
        isProduction: boolean;
}) {
        if (installed) return;
        installed = true;

        let shuttingDown = false;

        const clearGuild = async () => {
                try {
                        await rest.put(Routes.applicationGuildCommands(clientId, supportGuildId), {
                                body: []
                        });
                } catch (err) {
                        console.error('Failed to clear guild commands on shutdown:', err);
                }
        };

        const handleShutdown = (signal: NodeJS.Signals) => {
                if (shuttingDown) return;
                shuttingDown = true;

                (async () => {
                        await clearGuild();
                        process.exit(0);
                })().catch(error => {
                        console.error('Failed to handle shutdown signal:', signal, error);
                        process.exit(0);
                });
        };

        ['SIGINT', 'SIGTERM'].forEach(sig => {
                process.once(sig as NodeJS.Signals, () => handleShutdown(sig as NodeJS.Signals));
        });
}
