import type { IMember } from '@oldschoolgg/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ioredis', async () => {
	const { MockedRedis } = await import('../../src/lib/cache/redis-mock.js');

	class MockRedis extends MockedRedis {
		on() {
			return this;
		}

		disconnect() {
			return undefined;
		}
	}

	return { Redis: MockRedis };
});

import '../../src/lib/cache/redis.js';

describe('Cache.getOrFetchMember', () => {
	const guildId = '123';
	const userId = '456';
	const member: IMember = {
		guild_id: guildId,
		user_id: userId,
		roles: ['role-id'],
		permissions: []
	};

	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(Logging, 'logDebug').mockImplementation(() => undefined);
		vi.spyOn(Logging, 'logError').mockImplementation(() => undefined);
	});

	it('returns cached member without REST fetch', async () => {
		const getMember = vi.spyOn(Cache, 'getMember').mockResolvedValue(member);
		const setMember = vi.spyOn(Cache, 'setMember').mockResolvedValue();

		global.globalClient = { fetchMember: vi.fn() } as any;

		const result = await Cache.getOrFetchMember(guildId, userId);

		expect(result).toEqual(member);
		expect(getMember).toHaveBeenCalledWith(guildId, userId);
		expect(setMember).not.toHaveBeenCalled();
		expect(globalClient.fetchMember).not.toHaveBeenCalled();
	});

	it('fetches and caches member on cache miss', async () => {
		const getMember = vi.spyOn(Cache, 'getMember').mockResolvedValue(null);
		const setMember = vi.spyOn(Cache, 'setMember').mockResolvedValue();
		const fetchMember = vi.fn().mockResolvedValue(member);

		global.globalClient = { fetchMember } as any;

		const result = await Cache.getOrFetchMember(guildId, userId);

		expect(result).toEqual(member);
		expect(getMember).toHaveBeenCalledWith(guildId, userId);
		expect(fetchMember).toHaveBeenCalledWith({ guildId, userId });
		expect(setMember).toHaveBeenCalledWith(member);
	});

	it('returns null when REST fetch fails', async () => {
		vi.spyOn(Cache, 'getMember').mockResolvedValue(null);
		const setMember = vi.spyOn(Cache, 'setMember').mockResolvedValue();
		const fetchMember = vi.fn().mockRejectedValue(new Error('no member'));

		global.globalClient = { fetchMember } as any;

		const result = await Cache.getOrFetchMember(guildId, userId);

		expect(result).toBeNull();
		expect(fetchMember).toHaveBeenCalledWith({ guildId, userId });
		expect(setMember).not.toHaveBeenCalled();
	});
});
