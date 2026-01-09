export const prerender = false;

import type { APIRoute } from 'astro';

import { generateShareBanner } from '@/lib/share/banner.js';

export const GET: APIRoute = async ({ params, request }) => {
	const userId = params.userId;
	if (!userId) {
		return new Response('Missing user id', { status: 400 });
	}

	const url = new URL(request.url);
	const botParam = url.searchParams.get('bot');
	const style = url.searchParams.get('style');
	const bot = botParam === 'bso' ? 'bso' : botParam === 'osb' ? 'osb' : null;

	const { buffer, contentType } = await generateShareBanner({ userId, bot, style });

	return new Response(buffer, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=600'
		}
	});
};
