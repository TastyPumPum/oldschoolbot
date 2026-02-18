import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Items } from 'oldschooljs';

import { CHRONICLE_CACHE, CHRONICLE_COOLDOWN_CACHE } from '@/lib/cache.js';
import { canvasToBuffer, createCanvas } from '@/lib/canvas/canvasUtil.js';
import { allCollectionLogsFlat } from '@/lib/data/Collections.js';
import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';

const PERIOD_LOOKBACK_MS = {
	last30days: Time.Day * 30,
	season: Time.Day * 90
} as const;

const PERIOD_LABELS = {
	last30days: 'Last 30 Days',
	monthly: 'Monthly',
	season: 'Season'
} as const;

type ChroniclePeriod = keyof typeof PERIOD_LABELS;
type ChronicleStyle = 'dark' | 'light' | 'retroRune' | 'minimal';

export interface ChronicleStats {
	periodLabel: string;
	totalKCGained: number;
	totalLootValueGained: number | null;
	biggestDropName: string | null;
	biggestDropValue: number | null;
	mostKilledName: string | null;
	mostKilledKC: number;
	mostTrainedSkill: string | null;
	mostTrainedXP: number;
	clogSlotsGained: number | null;
	generatedAt: Date;
	privacy: boolean;
}

function gpBucket(gp: number) {
	if (gp < 10_000_000) return '0–10m';
	if (gp < 50_000_000) return '10–50m';
	if (gp < 200_000_000) return '50–200m';
	if (gp < 1_000_000_000) return '200m–1b';
	return '1b+';
}

function maybePrivateGP(gp: number | null, privacy: boolean) {
	if (gp === null) return 'Insufficient tracked history';
	return privacy ? gpBucket(gp) : `${gp.toLocaleString()} GP`;
}

function styleColors(style: ChronicleStyle) {
	if (style === 'light') {
		return { bg: '#F6F8FB', panel: '#FFFFFF', text: '#1F2937', sub: '#4B5563', accent: '#2563EB' };
	}
	if (style === 'retroRune') {
		return { bg: '#1b1f13', panel: '#2b3322', text: '#e7d89c', sub: '#b8ac7f', accent: '#c1a35f' };
	}
	if (style === 'minimal') {
		return { bg: '#0E0E10', panel: '#16171A', text: '#F4F4F5', sub: '#A1A1AA', accent: '#A78BFA' };
	}
	return { bg: '#0F172A', panel: '#111827', text: '#E5E7EB', sub: '#9CA3AF', accent: '#22D3EE' };
}

function getStartDate(period: ChroniclePeriod) {
	if (period === 'monthly') {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), 1);
	}
	if (period === 'last30days' || period === 'season') {
		return new Date(Date.now() - PERIOD_LOOKBACK_MS[period]);
	}
	return new Date(Date.now() - Time.Day * 30);
}

export function chronicleCacheKey(userID: string, period: ChroniclePeriod, style: ChronicleStyle, privacy: boolean) {
	return `${userID}:${period}:${style}:${privacy ? '1' : '0'}`;
}

function getDropFromCompletedLogs(logNames: string[]) {
	let biggestDropName: string | null = null;
	let biggestDropValue: number | null = null;

	for (const logName of logNames) {
		const cl = allCollectionLogsFlat.find(i => i.name.toLowerCase() === logName.toLowerCase());
		if (!cl) continue;
		for (const itemID of cl.items.values()) {
			const item = Items.get(itemID);
			if (!item?.price) continue;
			if (biggestDropValue === null || item.price > biggestDropValue) {
				biggestDropValue = item.price;
				biggestDropName = item.name;
			}
		}
	}

	return { biggestDropName, biggestDropValue };
}

async function computeChronicleStats(user: MUser, period: ChroniclePeriod, privacy: boolean): Promise<ChronicleStats> {
	const startDate = getStartDate(period);
	const nowISO = new Date().toISOString();

	const [kcRows, xpRows, completedLogRows, beforeWindowSnapshot, latestSnapshot] = await Promise.all([
		prisma.$queryRawUnsafe<{ mi: number; kc: bigint }[]>(`
			SELECT (a.data->>'mi')::int AS mi, SUM((a.data->>'q')::int)::bigint AS kc
			FROM activity a
			WHERE a.user_id = ${user.id}
			AND a.completed = true
			AND a.finish_date >= '${startDate.toISOString()}'
			AND a.type IN ('MonsterKilling', 'GroupMonsterKilling')
			AND a.data ? 'mi'
			GROUP BY (a.data->>'mi')::int;
		`),
		prisma.$queryRawUnsafe<{ skill: string; xp: bigint }[]>(`
			SELECT skill::text, SUM(xp)::bigint AS xp
			FROM xp_gains
			WHERE user_id = ${user.id}
			AND date >= '${startDate.toISOString()}'
			GROUP BY skill;
		`),
		prisma.$queryRawUnsafe<{ name: string }[]>(`
			SELECT collection_log_name AS name
			FROM user_event
			WHERE user_id = '${user.id}'
			AND type = 'CLCompletion'
			AND date >= '${startDate.toISOString()}'
			AND collection_log_name IS NOT NULL;
		`),
		prisma.$queryRawUnsafe<{ gp: string; cl_count: number }[]>(`
			SELECT "GP"::text AS gp, cl_completion_count::int AS cl_count
			FROM historical_data
			WHERE user_id = '${user.id}'
			AND date < '${startDate.toISOString()}'
			ORDER BY date DESC
			LIMIT 1;
		`),
		prisma.$queryRawUnsafe<{ gp: string; cl_count: number }[]>(`
			SELECT "GP"::text AS gp, cl_completion_count::int AS cl_count
			FROM historical_data
			WHERE user_id = '${user.id}'
			AND date <= '${nowISO}'
			ORDER BY date DESC
			LIMIT 1;
		`)
	]);

	const totalKCGained = kcRows.reduce((sum, row) => sum + Number(row.kc), 0);
	const mostKilledRow = [...kcRows].sort((a, b) => Number(b.kc) - Number(a.kc))[0];
	const mostKilledName = mostKilledRow
		? (killableMonsters.find(mon => mon.id === mostKilledRow.mi)?.name ?? `Monster #${mostKilledRow.mi}`)
		: null;

	const mostXPRow = [...xpRows].sort((a, b) => Number(b.xp) - Number(a.xp))[0];
	const mostTrainedSkill = mostXPRow?.skill ?? null;
	const mostTrainedXP = mostXPRow ? Number(mostXPRow.xp) : 0;

	const { biggestDropName, biggestDropValue } = getDropFromCompletedLogs(completedLogRows.map(i => i.name));

	const preWindow = beforeWindowSnapshot[0];
	const postWindow = latestSnapshot[0];
	const totalLootValueGained =
		preWindow && postWindow ? Math.max(0, Number(postWindow.gp) - Number(preWindow.gp)) : null;
	const clogSlotsGained =
		preWindow && postWindow ? Math.max(0, Number(postWindow.cl_count) - Number(preWindow.cl_count)) : null;

	return {
		periodLabel: PERIOD_LABELS[period],
		totalKCGained,
		totalLootValueGained,
		biggestDropName,
		biggestDropValue,
		mostKilledName,
		mostKilledKC: mostKilledRow ? Number(mostKilledRow.kc) : 0,
		mostTrainedSkill,
		mostTrainedXP,
		clogSlotsGained,
		generatedAt: new Date(),
		privacy
	};
}

export async function generateChronicleCard({
	user,
	period,
	style,
	privacy
}: {
	user: MUser;
	period: ChroniclePeriod;
	style: ChronicleStyle;
	privacy: boolean;
}) {
	const key = chronicleCacheKey(user.id, period, style, privacy);
	const cached = CHRONICLE_CACHE.get(key);
	if (cached) return cached;

	const cooldownUntil = CHRONICLE_COOLDOWN_CACHE.get(key);
	if (cooldownUntil && cooldownUntil > Date.now()) {
		const remaining = formatDuration(cooldownUntil - Date.now(), true);
		return {
			cooldownMessage: `You're generating chronicles too quickly for this setup. Try again in ${remaining}.`
		};
	}
	const stats = await computeChronicleStats(user, period, privacy);
	const colors = styleColors(style);

	const canvas = createCanvas(1200, 1600);
	const ctx = canvas.getContext('2d');
	ctx.fillStyle = colors.bg;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = colors.panel;
	ctx.fillRect(40, 40, canvas.width - 80, canvas.height - 80);

	ctx.fillStyle = colors.accent;
	ctx.font = 'bold 48px sans-serif';
	ctx.fillText('📜 Chronicle', 80, 130);
	ctx.fillStyle = colors.text;
	ctx.font = '34px sans-serif';
	ctx.fillText(`${user.username} — ${stats.periodLabel}`, 80, 185);

	ctx.fillStyle = colors.sub;
	ctx.font = '24px sans-serif';
	ctx.fillText('Tier 3 ✦', 1040, 130);

	const lines = [
		['Total KC gained', stats.totalKCGained.toLocaleString()],
		['Total loot value gained', maybePrivateGP(stats.totalLootValueGained, privacy)],
		[
			'Biggest single drop',
			stats.biggestDropName
				? `${stats.biggestDropName} (${maybePrivateGP(stats.biggestDropValue, privacy)})`
				: 'No notable drops recorded'
		],
		[
			'Most-killed boss/monster',
			stats.mostKilledName
				? `${stats.mostKilledName} (${stats.mostKilledKC.toLocaleString()} KC)`
				: 'No boss KC recorded'
		],
		[
			'Most-trained skill',
			stats.mostTrainedSkill
				? `${stats.mostTrainedSkill} (${stats.mostTrainedXP.toLocaleString()} XP)`
				: 'No skill XP recorded'
		],
		['Collection log slots gained', stats.clogSlotsGained?.toLocaleString() ?? 'Insufficient tracked history']
	] as const;

	let y = 300;
	for (const [title, value] of lines) {
		ctx.fillStyle = colors.sub;
		ctx.font = '26px sans-serif';
		ctx.fillText(title, 90, y);
		ctx.fillStyle = colors.text;
		ctx.font = 'bold 34px sans-serif';
		ctx.fillText(value, 90, y + 45);
		y += 190;
	}

	ctx.fillStyle = colors.sub;
	ctx.font = '22px sans-serif';
	ctx.fillText(`Generated ${stats.generatedAt.toLocaleString('en-CA')}`, 80, 1500);
	ctx.fillText('Tier 3', 1080, 1500);

	const buffer = await canvasToBuffer(canvas);
	const result = { buffer, stats };
	CHRONICLE_CACHE.set(key, result);
	CHRONICLE_COOLDOWN_CACHE.set(key, Date.now() + Time.Minute * 10);
	return result;
}

export function chronicleCaption(username: string, stats: ChronicleStats) {
	const highlights = [
		`KC +${stats.totalKCGained.toLocaleString()}`,
		stats.biggestDropName ? `Best drop: ${stats.biggestDropName}` : 'No notable drops'
	];
	return `📜 Your Chronicle — ${stats.periodLabel}\n${username}: ${highlights.join(' • ')}`;
}
