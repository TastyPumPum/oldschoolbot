import type { SendableMessage } from '@oldschoolgg/discord';
import type { IMessage } from '@oldschoolgg/schemas';

export async function sendToChannelID(channelID: string, message: SendableMessage): Promise<IMessage | null> {
	try {
		if (!(await globalClient.channelIsSendable(channelID))) {
			return null;
		}

		return await globalClient.sendMessage(channelID, message);
	} catch (err) {
		Logging.logError(err as Error, { channel_id: channelID, type: 'send_to_channel_id' });
		return null;
	}
}
