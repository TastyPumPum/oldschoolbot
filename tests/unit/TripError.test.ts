import { UserError } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { TripError } from '@/lib/structures/TripError.js';

const userId = '123456789012345678';
const teammateId = '234567890123456789';

describe('TripError', () => {
	test('identifies trip failures separately from other user errors', () => {
		const error = new TripError('You need more food.', [userId]);
		expect(error).toBeInstanceOf(UserError);
		expect(error.name).toBe('TripError');
		expect(error.toResponse()).toEqual({
			content: `<@${userId}>, You need more food.`,
			allowedMentions: { users: [userId] }
		});
	});

	test('pings only the affected users and deduplicates their IDs', () => {
		const error = new TripError(`<@${teammateId}> needs more arrows.`, [userId, teammateId, userId]);
		expect(error.toResponse()).toEqual({
			content: `<@${userId}>, <@${teammateId}> needs more arrows.`,
			allowedMentions: { users: [userId, teammateId] }
		});
	});

	test('keeps other mentions suppressed and preserves ephemeral replies', () => {
		const error = new TripError(`Missing supplies. <@${teammateId}> @everyone`, [userId], { ephemeral: true });
		expect(error.toResponse()).toEqual({
			content: `<@${userId}>, Missing supplies. <@${teammateId}> @everyone`,
			allowedMentions: { users: [userId] },
			ephemeral: true
		});
	});

	test('recognises existing nickname mentions', () => {
		expect(new TripError(`<@!${userId}> needs more charges.`, [userId]).toResponse().content).toBe(
			`<@!${userId}> needs more charges.`
		);
	});
});
