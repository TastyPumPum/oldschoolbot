import { userMention } from '@oldschoolgg/discord';
import { UserError } from '@oldschoolgg/toolkit';

export class TripError extends UserError {
	constructor(
		message: string,
		public readonly userIds: readonly string[],
		private readonly options: Omit<BaseSendableMessage, 'content' | 'allowedMentions'> = {}
	) {
		super(message);
		this.name = 'TripError';
	}

	toResponse(): BaseSendableMessage {
		const userIds = [...new Set(this.userIds)];
		const missingMentions = userIds.filter(
			id => !this.message.includes(userMention(id)) && !this.message.includes(`<@!${id}>`)
		);
		return {
			...this.options,
			content: `${missingMentions.length > 0 ? `${missingMentions.map(userMention).join(' ')}, ` : ''}${this.message}`,
			allowedMentions: { users: userIds }
		};
	}
}
