import { expect } from 'vitest';

export function expectTripFailure(response: Awaited<CommandResponse>, user: MUser, expectedMessage?: string): string {
	expect(response).toHaveProperty('content', expect.any(String));
	const message = response as BaseSendableMessage;
	expect(message.allowedMentions?.users).toEqual([user.id]);
	expect(message.content).toContain(user.mention);
	if (expectedMessage !== undefined) expect(message.content).toContain(expectedMessage);
	return message.content!;
}
