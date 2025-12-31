import { cryptoRng } from '@oldschoolgg/rng/crypto';

import type { NewUser } from '@/prisma/main.js';
import { rawCommandHandlerInner } from '@/discord/commandHandler.js';

export async function getNewUser(id: string): Promise<NewUser> {
	const value = await prisma.newUser.findUnique({ where: { id } });
	if (!value) {
		return prisma.newUser.create({
			data: {
				id,
				minigame: {}
			}
		});
	}
	return value;
}

export interface RunCommandArgs {
	commandName: string;
	args: CommandOptions;
	user: MUser;
	isContinue?: boolean;
	interaction: MInteraction;
	continueDeltaMillis: number | null;
	ignoreUserIsBusy?: true;
}

export async function runCommand({
	commandName,
	args,
	interaction,
	ignoreUserIsBusy,
	isContinue
}: RunCommandArgs): CommandResponse {
	const command = globalClient.allCommands.find(c => c.name === commandName)!;

	const shouldIgnoreBusy = ignoreUserIsBusy ?? (isContinue ? true : undefined);
	const response: Awaited<CommandResponse> = await rawCommandHandlerInner({
		interaction,
		command,
		options: args,
		ignoreUserIsBusy: shouldIgnoreBusy,
		rng: cryptoRng
	});
	return response;
}
