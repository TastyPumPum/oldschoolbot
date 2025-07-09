import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { Bank } from 'oldschooljs';

import { blackjackCommand } from '../../../src/mahoji/lib/abstracted_commands/blackjackCommand';
import { createTestUser, type TestUser } from '../util';

// Mock deck shuffling and user interaction
let deck: string[] = [];
vi.mock('e', async () => {
        const actual: any = await vi.importActual('e');
        return {
                ...actual,
                shuffleArr: () => deck.slice()
        };
});

const interactions: any[] = [];
vi.mock('@oldschoolgg/toolkit/util', async () => {
        const actual: any = await vi.importActual('@oldschoolgg/toolkit/util');
        return {
                ...actual,
                awaitMessageComponentInteraction: vi.fn().mockImplementation(() => interactions.shift()),
                channelIsSendable: () => true
        };
});

const fakeMessage = { edit: vi.fn(), reply: vi.fn() } as any;
const fakeInteraction = {
        user: { id: '1', bot: false },
        channel: { send: vi.fn().mockResolvedValue(fakeMessage) }
} as any;

describe('Blackjack Split', () => {
        let user: TestUser;

        beforeAll(async () => {
                user = await createTestUser();
        });

        beforeEach(async () => {
                await user.reset();
                await user.addItemsToBank({ items: new Bank().add('Coins', 1_000_000) });
                deck = [
                        '8_spades',
                        '8_hearts',
                        '10_clubs',
                        '10_diamonds',
                        '5_clubs',
                        '6_diamonds'
                ];
                interactions.length = 0;
                interactions.push(
                        { customId: 'SPLIT', deferUpdate: vi.fn(), user: { id: '1' } } as any,
                        { customId: 'STAND', deferUpdate: vi.fn(), user: { id: '1' } } as any,
                        { customId: 'STAND', deferUpdate: vi.fn(), user: { id: '1' } } as any
                );
        });

        test('handles split hand', async () => {
                const result = await blackjackCommand(fakeInteraction, user, '100k');
                expect(result.content).toContain('Hand 1: lost.\nHand 2: lost.');
                await user.gpMatch(800_000); // lost two hands = lose 200k
        });
});
