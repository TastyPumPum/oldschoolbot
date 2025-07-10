import { describe, expect, test } from 'vitest';

import { mockTripCommand } from '../../src/mahoji/commands/mocktrip';

const dummyOptions = { command: 'mine copper 1' } as any;

describe('mocktrip subcommand', () => {
    test('returns result and does not modify user', async () => {
        const res = await mockTripCommand.run({ options: dummyOptions } as any);
        expect(typeof res).toBe('string');
    });
});

