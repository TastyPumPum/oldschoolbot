import { toTitleCase } from '@oldschoolgg/toolkit';

import Hunter from '@/lib/skilling/skills/hunter/hunter.js';
import {
	type HunterRumourState,
	hunterRumourTierInfo,
	isRumourTierUnlocked,
	type RumourTier
} from '@/lib/skilling/skills/hunter/rumours.js';

const rumourChoices: { name: string; value: RumourTier }[] = [
	{ name: 'Novice', value: 'Novice' },
	{ name: 'Adept', value: 'Adept' },
	{ name: 'Expert', value: 'Expert' },
	{ name: 'Master', value: 'Master' }
];

function formatRumourState(state: HunterRumourState) {
	const lines: string[] = [];
	lines.push(`Back-to-back rumours: ${state.backToBack ? 'enabled' : 'disabled'}`);
	const assignments = Object.values(state.assignments).filter(Boolean);
	if (assignments.length === 0) {
		lines.push('No active rumours.');
	} else {
		for (const assignment of assignments) {
			if (!assignment) continue;
			const creature = Hunter.Creatures.find(c => c.id === assignment.creatureID);
			lines.push(
				`${assignment.tier}: ${creature?.name ?? 'Unknown creature'} (${assignment.progress} catches)` +
					(assignment.completed ? ' - completed' : '')
			);
		}
	}

	if (state.blockedCreatureIds.length > 0) {
		const blocked = state.blockedCreatureIds
			.map(id => Hunter.Creatures.find(c => c.id === id)?.name ?? id.toString())
			.join(', ');
		lines.push(`Blocked: ${blocked}`);
	}

	return lines.join('\n');
}

export const hunterRumoursCommand = defineCommand({
	name: 'hunterrumours',
	description: "Manage the Hunter Guild's rumours.",
	attributes: {
		requiresMinion: true
	},
	options: [
		{
			type: 'String',
			name: 'action',
			description: 'What do you want to do?',
			required: true,
			choices: [
				{ name: 'Status', value: 'status' },
				{ name: 'Assign', value: 'assign' },
				{ name: 'Abandon', value: 'abandon' },
				{ name: 'Toggle back-to-back', value: 'toggle' }
			]
		},
		{
			type: 'String',
			name: 'tier',
			description: 'Rumour tier to manage (required for assign/abandon).',
			required: false,
			choices: rumourChoices
		}
	],
	run: async ({ options, user }) => {
		const action = options.action as string;
		const tier = options.tier as RumourTier | undefined;

		if (action === 'status') {
			const state = await user.getHunterRumourState();
			return formatRumourState(state);
		}

		if (!tier) {
			return 'You need to provide a rumour tier for that action.';
		}

		switch (action) {
			case 'assign': {
				const tierInfo = hunterRumourTierInfo[tier];
				if (!isRumourTierUnlocked(tier, user.skillsAsLevels.hunter)) {
					return `${user.minionName} needs ${tierInfo.levelRequirement} Hunter for ${toTitleCase(
						tier
					)} rumours.`;
				}

				const newState = await user.requestHunterRumour(tier);
				const assignment = newState.assignments[tier];
				const creature = assignment ? Hunter.Creatures.find(c => c.id === assignment.creatureID) : null;

				return creature
					? `${user.minionName} will investigate ${creature.name} for a ${toTitleCase(tier)} rumour.`
					: 'Unable to assign a rumour right now.';
			}
			case 'abandon': {
				const beforeState = await user.getHunterRumourState();
				if (!beforeState.assignments[tier]) {
					return `No ${toTitleCase(tier)} rumour to abandon.`;
				}
				await user.abandonHunterRumour(tier);
				return `${toTitleCase(tier)} rumour cleared.`;
			}
			case 'toggle': {
				const state = await user.toggleHunterRumourBackToBack();
				return `Back-to-back rumours are now ${state.backToBack ? 'enabled' : 'disabled'}.`;
			}
			default:
				return 'Unknown action.';
		}
	}
});
