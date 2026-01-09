import { Canvas, loadImage } from 'skia-canvas';

import { fetchShareProfile } from './shareData.js';

const WIDTH = 1200;
const HEIGHT = 630;
const CACHE_TTL_MS = 10 * 60 * 1000;

const bannerCache = new Map<string, { createdAt: number; buffer: Buffer }>();

function getTheme(bot: 'osb' | 'bso') {
	return bot === 'bso' ? { primary: '#ff8c62', secondary: '#5a2a1f' } : { primary: '#4ca1ff', secondary: '#0b2740' };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.lineTo(x + width - radius, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
	ctx.lineTo(x + width, y + height - radius);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
	ctx.lineTo(x + radius, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
	ctx.lineTo(x, y + radius);
	ctx.quadraticCurveTo(x, y, x + radius, y);
	ctx.closePath();
}

function drawProgressCard(
	ctx: CanvasRenderingContext2D,
	{
		x,
		y,
		label,
		value,
		progress,
		accent
	}: {
		x: number;
		y: number;
		label: string;
		value: string;
		progress: number;
		accent: string;
	}
) {
	const cardWidth = 320;
	const cardHeight = 120;
	ctx.fillStyle = 'rgba(8, 12, 20, 0.65)';
	roundRect(ctx, x, y, cardWidth, cardHeight, 16);
	ctx.fill();

	ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
	ctx.font = '600 18px Inter, sans-serif';
	ctx.fillText(label, x + 20, y + 34);

	ctx.fillStyle = '#ffffff';
	ctx.font = '700 26px Inter, sans-serif';
	ctx.fillText(value, x + 20, y + 70);

	const barX = x + 20;
	const barY = y + 88;
	const barWidth = cardWidth - 40;
	const barHeight = 10;
	ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
	roundRect(ctx, barX, barY, barWidth, barHeight, 6);
	ctx.fill();

	ctx.fillStyle = accent;
	roundRect(ctx, barX, barY, Math.max(6, barWidth * progress), barHeight, 6);
	ctx.fill();
}

export async function generateShareBanner({
	userId,
	bot,
	style
}: {
	userId: string;
	bot: 'osb' | 'bso' | null;
	style?: string | null;
}): Promise<{ buffer: Buffer; contentType: string }> {
	const cacheKey = `${userId}:${bot ?? 'auto'}:${style ?? 'default'}`;
	const cached = bannerCache.get(cacheKey);
	const now = Date.now();
	if (cached && now - cached.createdAt < CACHE_TTL_MS) {
		return { buffer: cached.buffer, contentType: 'image/png' };
	}

	const profile = await fetchShareProfile({ userId, bot });
	const theme = getTheme(profile.bot);

	const canvas = new Canvas(WIDTH, HEIGHT);
	const ctx = canvas.getContext('2d');

	const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
	gradient.addColorStop(0, theme.secondary);
	gradient.addColorStop(1, '#0b0f1c');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, WIDTH, HEIGHT);

	ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
	for (let y = 0; y < HEIGHT; y += 80) {
		for (let x = 0; x < WIDTH; x += 80) {
			ctx.beginPath();
			ctx.arc(x + 20, y + 20, 6, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	const logoUrl = `https://cdn.oldschool.gg/website/${profile.bot}-avatar-100.webp`;
	let logoImage: Image | null = null;
	try {
		logoImage = await loadImage(logoUrl);
	} catch (error) {
		logoImage = null;
	}

	let petImage: Image | null = null;
	if (profile.petItemId) {
		try {
			petImage = await loadImage(`https://chisel.weirdgloop.org/static/img/osrs-sprite/${profile.petItemId}.png`);
		} catch (error) {
			petImage = null;
		}
	}

	if (logoImage) {
		ctx.drawImage(logoImage, 60, 50, 88, 88);
	}

	ctx.fillStyle = theme.primary;
	ctx.font = '700 28px Inter, sans-serif';
	ctx.fillText(profile.bot.toUpperCase(), 160, 90);

	ctx.fillStyle = '#ffffff';
	ctx.font = '700 42px Inter, sans-serif';
	ctx.fillText(profile.minionName, 60, 170);

	ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
	ctx.font = '500 24px Inter, sans-serif';
	ctx.fillText(profile.discordName, 60, 210);

	ctx.fillStyle = '#ffffff';
	ctx.font = '800 64px Inter, sans-serif';
	ctx.fillText(profile.totalXp.toLocaleString(), 60, 300);

	ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
	ctx.font = '600 20px Inter, sans-serif';
	ctx.fillText('Total XP', 60, 330);

	drawProgressCard(ctx, {
		x: 60,
		y: 360,
		label: 'Collection Log',
		value: `${profile.collectionLogCount.toLocaleString()} / ${profile.collectionLogTotal.toLocaleString()}`,
		progress: profile.collectionLogTotal > 0 ? profile.collectionLogCount / profile.collectionLogTotal : 0,
		accent: theme.primary
	});

	drawProgressCard(ctx, {
		x: 410,
		y: 360,
		label: 'Combat Achievements',
		value: `${profile.combatAchievementsCount.toLocaleString()} / ${profile.combatAchievementsTotal.toLocaleString()}`,
		progress:
			profile.combatAchievementsTotal > 0 ? profile.combatAchievementsCount / profile.combatAchievementsTotal : 0,
		accent: '#f5b44d'
	});

	drawProgressCard(ctx, {
		x: 760,
		y: 360,
		label: 'Total Level',
		value: profile.totalLevel.toLocaleString(),
		progress: Math.min(profile.totalLevel / 2277, 1),
		accent: '#6ad89e'
	});

	if (petImage) {
		ctx.drawImage(petImage, 980, 70, 140, 140);
	} else if (logoImage) {
		ctx.drawImage(logoImage, 980, 70, 140, 140);
	}

	ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
	ctx.font = '500 18px Inter, sans-serif';
	ctx.fillText(`Generated by oldschool.gg • ${new Date().toLocaleString('en-US')}`, 60, 590);

	const buffer = await canvas.toBuffer('png');
	bannerCache.set(cacheKey, { createdAt: now, buffer });
	return { buffer, contentType: 'image/png' };
}
