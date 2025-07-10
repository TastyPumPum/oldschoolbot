import { type CommandRunOptions, stringMatches } from '@oldschoolgg/toolkit/util';
import { ApplicationCommandOptionType } from 'discord.js';
import { Time } from 'e';
import { Bank, convertLVLtoXP } from 'oldschooljs';

import { TOBMaxMageGear, TOBMaxMeleeGear, TOBMaxRangeGear } from '../../lib/data/tob';
import Mining from '../../lib/skilling/skills/mining';
import { SkillsArray } from '../../lib/skilling/types';
import { Gear } from '../../lib/structures/Gear';
import { calcMaxTripLength } from '../../lib/util/calcMaxTripLength';
import { determineMiningTrip } from './mine';
import { determineMiningResult } from '../../tasks/minions/miningActivity';
import { mockMUser } from '../../tests/unit/userutil';
import type { OSBMahojiCommand } from '../lib/util';

export const mockTripCommand: OSBMahojiCommand = {
    name: 'mocktrip',
    description: 'Instantly simulate a trip on a maxed mock account.',
    options: [
        {
            type: ApplicationCommandOptionType.String,
            name: 'command',
            description: 'Trip command text, e.g. "mine granite"',
            required: true
        }
    ],
    run: async ({ options }: CommandRunOptions<{ command: string }>) => {
        const input = options.command.split(/\s+/);
        const action = input.shift()?.toLowerCase();
        if (action !== 'mine') {
            return 'Only mining is supported.';
        }
        const oreName = input.shift();
        if (!oreName) return 'No ore specified.';
        const qty = input.length > 0 ? Number(input.shift()) : undefined;
        const ore = Mining.Ores.find(
            o =>
                stringMatches(o.name, oreName) ||
                stringMatches(o.id, oreName) ||
                o.aliases?.some(a => stringMatches(a, oreName))
        );
        if (!ore) return 'Invalid ore.';

        const maxXP = convertLVLtoXP(99);
        const skills: any = {};
        for (const skill of SkillsArray) skills[`skills_${skill}`] = maxXP;

        const bank = new Bank().add('Crystal pickaxe');
        for (const gear of [new Gear(TOBMaxMeleeGear), new Gear(TOBMaxRangeGear), new Gear(TOBMaxMageGear)]) {
            bank.add(gear.allItemsBank());
        }

        const mock = mockMUser({ ...skills, bank });
        mock.user.gear_melee = TOBMaxMeleeGear.raw() as any;
        mock.user.gear_range = TOBMaxRangeGear.raw() as any;
        mock.user.gear_mage = TOBMaxMageGear.raw() as any;
        mock.updateProperties();

        const trip = determineMiningTrip({
            gearBank: mock.gearBank,
            ore,
            maxTripLength: calcMaxTripLength(mock, 'Mining'),
            isPowermining: false,
            quantityInput: qty,
            hasKaramjaMedium: false,
            randomVariationEnabled: false
        });
        const result = determineMiningResult({
            ore,
            quantity: trip.quantity,
            gearBank: mock.gearBank,
            duration: trip.duration,
            isPowermining: false,
            hasFinishedCOTS: true
        });
        const xpHr = (
            (result.updateBank.xpBank.totalXP() / (trip.duration / Time.Minute)) * 60
        ).toFixed(1);
        return `Mined ${trip.quantity} ${ore.name} for ${result.updateBank.xpBank.toString()} (${xpHr} xp/hr) and ${result.updateBank.itemLootBank}.`;
    }
};
