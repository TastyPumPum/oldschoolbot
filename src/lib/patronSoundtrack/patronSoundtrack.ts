import fs from 'node:fs';
import path from 'node:path';
import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	VoiceConnectionStatus
} from '@discordjs/voice';
import { Time } from '@oldschoolgg/toolkit';

import { globalConfig, PerkTier } from '@/lib/constants.js';
import type { MUser } from '@/lib/MUser.js';
import { Logging } from '@/lib/structures/Logging.js';
import { createVoiceAdapterCreator, getUserVoiceChannelId } from '@/lib/voice/voiceManager.js';

export const PATRON_SOUNDTRACK_THEMES = ['tavern', 'dungeon', 'forest', 'sea'] as const;
export type PatronSoundtrackTheme = (typeof PATRON_SOUNDTRACK_THEMES)[number];

const SOUNDTRACK_FILES: Record<PatronSoundtrackTheme, string> = {
	tavern: 'assets/soundtracks/tavern.ogg',
	dungeon: 'assets/soundtracks/dungeon.ogg',
	forest: 'assets/soundtracks/forest.ogg',
	sea: 'assets/soundtracks/sea.ogg'
};

const MIN_TRIP_DURATION_MS = Time.Minute * 15;
const GUILD_COOLDOWN_MS = Time.Minute * 3;
const USER_COOLDOWN_MS = Time.Minute * 5;
const MAX_ACTIVE_SOUNDTRACKS = 10;
const PLAYBACK_DURATION_MS = 5000;
const CONNECTION_TIMEOUT_MS = 10_000;

export const PATRON_SOUNDTRACK_MIN_TRIP_DURATION_MS = MIN_TRIP_DURATION_MS;
export const PATRON_SOUNDTRACK_GUILD_COOLDOWN_MS = GUILD_COOLDOWN_MS;
export const PATRON_SOUNDTRACK_USER_COOLDOWN_MS = USER_COOLDOWN_MS;

const guildCooldowns = new Map<string, number>();
let activeSoundtracks = 0;

function featureEnabled() {
	return globalConfig.patronSoundtracksEnabled;
}

async function playClip(guildId: string, channelId: string, theme: PatronSoundtrackTheme) {
	const filePath = SOUNDTRACK_FILES[theme];
	const resolvedPath = path.resolve(filePath);
	if (!fs.existsSync(resolvedPath)) {
		Logging.logDebug(`Skipping patron soundtrack for guild ${guildId}: missing file for ${theme}`);
		return;
	}
	const connection = joinVoiceChannel({
		channelId,
		guildId,
		selfDeaf: true,
		adapterCreator: createVoiceAdapterCreator(guildId)
	});
	try {
		await entersState(connection, VoiceConnectionStatus.Ready, CONNECTION_TIMEOUT_MS);
		const player = createAudioPlayer();
		const resource = createAudioResource(resolvedPath, { inlineVolume: true });
		resource.volume?.setVolume(0.35);

		const subscription = connection.subscribe(player);
		player.play(resource);

		const stopTimeout = setTimeout(() => {
			if (player.state.status !== AudioPlayerStatus.Idle) {
				player.stop();
			}
		}, PLAYBACK_DURATION_MS);

		await entersState(player, AudioPlayerStatus.Idle, PLAYBACK_DURATION_MS + 2000).catch(() => undefined);
		clearTimeout(stopTimeout);
		subscription?.unsubscribe();
	} finally {
		connection.destroy();
	}
}

export async function maybePlayPatronSoundtrack({
	user,
	guildId,
	duration
}: {
	user: MUser;
	guildId: string | null;
	duration: number;
}): Promise<void> {
	if (!featureEnabled()) return;
	if (!guildId) return;
	if (duration < MIN_TRIP_DURATION_MS) return;

	const perkTier = await user.fetchPerkTier();
	if (perkTier < PerkTier.One) return;

	const { patron_soundtrack_enabled, patron_soundtrack_theme, patron_soundtrack_last_played } = user.user;

	if (!patron_soundtrack_enabled) return;
	if (!patron_soundtrack_theme || !SOUNDTRACK_FILES[patron_soundtrack_theme as PatronSoundtrackTheme]) return;

	const theme = patron_soundtrack_theme as PatronSoundtrackTheme;
	const now = Date.now();
	const lastGuildPlay = guildCooldowns.get(guildId);
	if (lastGuildPlay && now - lastGuildPlay < GUILD_COOLDOWN_MS) return;

	if (activeSoundtracks >= MAX_ACTIVE_SOUNDTRACKS) return;

	const lastUserPlay = patron_soundtrack_last_played?.getTime();
	if (lastUserPlay && now - lastUserPlay < USER_COOLDOWN_MS) return;

	const voiceChannelId = getUserVoiceChannelId(guildId, user.id);
	if (!voiceChannelId) return;

	guildCooldowns.set(guildId, now);
	activeSoundtracks++;

	try {
		await playClip(guildId, voiceChannelId, theme);
		await user.update({ patron_soundtrack_last_played: new Date() });
	} catch (err) {
		Logging.logError(err as Error);
	} finally {
		activeSoundtracks = Math.max(0, activeSoundtracks - 1);
	}
}

export function patronSoundtrackThemeLabel(theme: PatronSoundtrackTheme) {
	return `${theme[0].toUpperCase()}${theme.slice(1)}`;
}
