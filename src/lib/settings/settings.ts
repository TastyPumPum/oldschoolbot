import { cryptoRng } from '@oldschoolgg/rng';

import type { NewUser } from '@/prisma/main.js';

type RawCommandHandlerInner = typeof import('@/lib/discord/commandHandler.js')['rawCommandHandlerInner'];

let cachedRawCommandHandlerInner: RawCommandHandlerInner | null = null;

async function getRawCommandHandlerInner(): Promise<RawCommandHandlerInner> {
	if (!cachedRawCommandHandlerInner) {
		({ rawCommandHandlerInner: cachedRawCommandHandlerInner } = await import('@/lib/discord/commandHandler.js'));
	}
	return cachedRawCommandHandlerInner;
}

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
	ignoreUserIsBusy
}: RunCommandArgs): CommandResponse {
	const command = globalClient.allCommands.find(c => c.name === commandName)!;

	const rawCommandHandlerInner = await getRawCommandHandlerInner();
	const response: Awaited<CommandResponse> = await rawCommandHandlerInner({
		interaction,
		command,
		options: args,
		ignoreUserIsBusy,
		rng: cryptoRng
	});
	return response;
}
