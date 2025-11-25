import type { DiscordGatewayAdapterCreator, DiscordGatewayAdapterLibraryMethods } from '@discordjs/voice';
import type { GatewayGuildCreateDispatchData } from '@oldschoolgg/discord';

import type { OldSchoolBotClient } from '@/discord/OldSchoolBotClient.js';

const adapters = new Map<string, Set<DiscordGatewayAdapterLibraryMethods>>();
const voiceStates = new Map<string, Map<string, string>>();
let client: OldSchoolBotClient | null = null;

type VoiceStateWithGuildId = {
	guild_id: string;
	channel_id: string | null;
	user_id: string;
};

function updateVoiceStateCache(state: VoiceStateWithGuildId) {
	if (!state.guild_id) return;
	const guildStates = voiceStates.get(state.guild_id) ?? new Map<string, string>();
	if (state.channel_id) {
		guildStates.set(state.user_id, state.channel_id);
	} else {
		guildStates.delete(state.user_id);
	}
	voiceStates.set(state.guild_id, guildStates);
}

export function initVoiceManager(botClient: OldSchoolBotClient) {
	if (client) return;
	client = botClient;

	client.on('voiceServerUpdate', payload => {
		const guildAdapters = adapters.get(payload.guild_id);
		if (!guildAdapters) return;
		for (const adapter of guildAdapters) {
			adapter.onVoiceServerUpdate(payload);
		}
	});

	client.on('guildCreate', (payload: GatewayGuildCreateDispatchData) => {
		if (!payload.voice_states) return;
		for (const state of payload.voice_states) {
			updateVoiceStateCache({
				guild_id: payload.id,
				channel_id: state.channel_id ?? null,
				user_id: state.user_id
			});
		}
	});

	client.on('voiceStateUpdate', payload => {
		if (!payload.guild_id) return;

		// Keep our cache in sync
		updateVoiceStateCache({
			guild_id: payload.guild_id,
			channel_id: payload.channel_id ?? null,
			user_id: payload.user_id
		});

		// Only forward updates for the bot itself to the adapters
		if (!client?.botUserId) return;
		if (payload.user_id !== client.botUserId) return;
		const guildAdapters = adapters.get(payload.guild_id);
		if (!guildAdapters) return;
		for (const adapter of guildAdapters) {
			adapter.onVoiceStateUpdate(payload);
		}
	});
}

export function getUserVoiceChannelId(guildId: string, userId: string): string | null {
	return voiceStates.get(guildId)?.get(userId) ?? null;
}

export function createVoiceAdapterCreator(guildId: string): DiscordGatewayAdapterCreator {
	return methods => {
		const guildAdapters = adapters.get(guildId) ?? new Set<DiscordGatewayAdapterLibraryMethods>();
		guildAdapters.add(methods);
		adapters.set(guildId, guildAdapters);

		return {
			sendPayload: payload => {
				if (!client) return false;
				client.sendGatewayPayload(payload, guildId).catch(err => Logging.logError(err as Error));
				return true;
			},
			destroy: () => {
				const existing = adapters.get(guildId);
				if (!existing) return;
				existing.delete(methods);
				if (existing.size === 0) {
					adapters.delete(guildId);
				}
			}
		};
	};
}
