import fs from 'node:fs';
import path from 'node:path';
import {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	joinVoiceChannel,
	StreamType,
	VoiceConnectionStatus
} from '@discordjs/voice';
import { Time } from '@oldschoolgg/toolkit';

import { globalConfig, PerkTier } from '@/lib/constants.js';
import { createVoiceAdapterCreator, getUserVoiceChannelId } from '@/lib/voice/voiceManager.js';

export const PATRON_SOUNDTRACK_THEMES = ['tavern', 'dungeon', 'forest', 'sea', 'christmas'] as const;
export type PatronSoundtrackTheme = (typeof PATRON_SOUNDTRACK_THEMES)[number];

const SOUNDTRACK_FILES: Record<PatronSoundtrackTheme, string> = {
	tavern: 'assets/soundtracks/tavern.ogg',
	dungeon: 'assets/soundtracks/dungeon.ogg',
	forest: 'assets/soundtracks/forest.ogg',
	sea: 'assets/soundtracks/sea.ogg',
	christmas: 'assets/soundtracks/christmas.opus.ogg'
};

const isDev = process.env.NODE_ENV !== 'production';

const MIN_TRIP_DURATION_MS = Time.Minute * 15;
const GUILD_COOLDOWN_MS = isDev ? Time.Second * 3 : Time.Minute * 3;
const USER_COOLDOWN_MS = isDev ? Time.Second * 5 : Time.Minute * 5;
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
		// Wait for the voice connection to be ready
		await entersState(connection, VoiceConnectionStatus.Ready, CONNECTION_TIMEOUT_MS);

		const player = createAudioPlayer();

		// Stream the (pre-encoded Ogg Opus) file
		const stream = fs.createReadStream(resolvedPath);

		const resource = createAudioResource(stream, {
			// CRUCIAL: no inlineVolume here, so FFmpeg is never used.
			// We're telling discord.js/voice this is already Opus-in-Ogg.
			inputType: StreamType.OggOpus
		});

		const subscription = connection.subscribe(player);
		player.play(resource);

		// Hard cap playback at PLAYBACK_DURATION_MS in case the clip is longer
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

	// Guild cooldown to avoid spamming the same VC
	const lastGuildPlay = guildCooldowns.get(guildId);
	if (lastGuildPlay && now - lastGuildPlay < GUILD_COOLDOWN_MS) return;

	// Global “how many are playing right now” cap
	if (activeSoundtracks >= MAX_ACTIVE_SOUNDTRACKS) return;

	// Per-user cooldown
	const lastUserPlay = patron_soundtrack_last_played?.getTime();
	if (lastUserPlay && now - lastUserPlay < USER_COOLDOWN_MS) return;

	// Only play if the user is actually in voice
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
