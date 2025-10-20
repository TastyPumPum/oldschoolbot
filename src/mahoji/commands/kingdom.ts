import { EmbedBuilder } from 'discord.js';

import { estimateDaysUntilCofferEmpty, projectDaily } from '@/lib/kingdom/index.js';
import {
	getCategoryLabel,
	KINGDOM_CATEGORY_DEFINITIONS,
	type KingdomProjectionInput,
	toPct
} from '@/lib/kingdom/types.js';

const categoryChoices = KINGDOM_CATEGORY_DEFINITIONS.map(definition => ({
	name: definition.label,
	value: definition.key
}));

function formatQuantity(quantity: number): string {
	if (quantity === 0) {
		return '0';
	}
	if (quantity < 0.01) {
		return quantity.toLocaleString('en-US', {
			minimumFractionDigits: 4,
			maximumFractionDigits: 4
		});
	}
	if (quantity < 1) {
		return quantity.toLocaleString('en-US', {
			minimumFractionDigits: 3,
			maximumFractionDigits: 3
		});
	}
	if (quantity < 10) {
		return quantity.toLocaleString('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
	}
	if (quantity < 100) {
		return quantity.toLocaleString('en-US', {
			minimumFractionDigits: 1,
			maximumFractionDigits: 1
		});
	}
	return quantity.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function splitExpectedValues(entries: [string, number][]): string[] {
	if (entries.length === 0) {
		return [];
	}
	const chunks: string[] = [];
	let buffer = '';
	for (const [item, qty] of entries) {
		const line = `**${item}**: ${formatQuantity(qty)}\n`;
		if ((buffer + line).length > 950) {
			chunks.push(buffer.trim());
			buffer = line;
		} else {
			buffer += line;
		}
	}
	if (buffer.length > 0) {
		chunks.push(buffer.trim());
	}
	return chunks;
}

function createProjectionInput(options: {
	days: number;
	workers: number;
	category: KingdomProjectionInput['category'];
	startingApprovalPct: number;
	royalTrouble: boolean;
	constantApproval: boolean;
	startingCoffer: number;
}): KingdomProjectionInput {
	return {
		days: Math.max(1, Math.floor(options.days)),
		workers: Math.max(0, Math.floor(options.workers)),
		category: options.category,
		startingApprovalPct: options.startingApprovalPct,
		royalTrouble: options.royalTrouble,
		constantApproval: options.constantApproval,
		startingCoffer: Math.max(0, Math.floor(options.startingCoffer))
	};
}

export const kingdomCommand = defineCommand({
	name: 'kingdom',
	description: 'Managing Miscellania calculator and projections.',
	options: [
		{
			type: 'Subcommand',
			name: 'status',
			description: 'Project expected value for a single category without collecting.',
			options: [
				{
					type: 'Integer',
					name: 'days',
					description: 'Number of days to simulate (clamped to 30).',
					required: true,
					min_value: 1,
					max_value: 45
				},
				{
					type: 'String',
					name: 'category',
					description: 'Category to allocate all workers to.',
					required: true,
					choices: categoryChoices
				},
				{
					type: 'Integer',
					name: 'workers',
					description: 'Number of workers assigned to this category.',
					required: true,
					min_value: 0,
					max_value: 15
				},
				{
					type: 'Integer',
					name: 'starting_approval_pct',
					description: 'Current approval percentage (0-100).',
					required: true,
					min_value: 0,
					max_value: 100
				},
				{
					type: 'Boolean',
					name: 'royal_trouble',
					description: 'Enable Royal Trouble bonuses?',
					required: false
				},
				{
					type: 'Boolean',
					name: 'constant_approval',
					description: 'Skip approval decay (maintain daily)?',
					required: false
				},
				{
					type: 'Integer',
					name: 'starting_coffer',
					description: 'GP currently in the coffer.',
					required: true,
					min_value: 0
				}
			]
		}
	],
	run: async ({ options }) => {
		const status = options.status;
		if (!status) {
			return 'You must use the status subcommand.';
		}

		const royalTrouble = status.royal_trouble ?? false;
		const constantApproval = status.constant_approval ?? false;
		const maxWorkers = royalTrouble ? 15 : 10;
		if (status.workers > maxWorkers) {
			return `You can assign at most ${maxWorkers} workers ${royalTrouble ? 'with' : 'without'} Royal Trouble.`;
		}

		const projectionInput = createProjectionInput({
			days: status.days,
			workers: status.workers,
			category: status.category,
			startingApprovalPct: status.starting_approval_pct,
			royalTrouble,
			constantApproval,
			startingCoffer: status.starting_coffer
		});

		const result = projectDaily(projectionInput);
		const categoryResult = result.byCategory[0];
		const approvalEndPct = toPct(result.endingApproval);
		const daysUntilEmpty = estimateDaysUntilCofferEmpty(projectionInput.startingCoffer, royalTrouble);

		const embed = new EmbedBuilder()
			.setTitle('Managing Miscellania Projection')
			.setColor(0x4a90e2)
			.setDescription('Projection only – no GP is deposited, withdrawn, or collected.');

		const simulatedDays = Math.min(30, projectionInput.days);

		const overviewLines = [
			`**Category:** ${getCategoryLabel(projectionInput.category)}`,
			`**Workers:** ${projectionInput.workers}`,
			`**Days simulated:** ${simulatedDays}`,
			`**Royal Trouble:** ${royalTrouble ? 'Yes' : 'No'}`,
			`**Constant approval:** ${constantApproval ? 'Yes' : 'No'}`
		];

		const cofferLines = [
			`**Starting coffer:** ${projectionInput.startingCoffer.toLocaleString()} GP`,
			`**Ending coffer:** ${result.endingCoffer.toLocaleString()} GP`,
			`**Coffer spent:** ${result.cofferSpent.toLocaleString()} GP`,
			`**Days until coffer hits 0:** ${daysUntilEmpty === null ? 'Unknown' : daysUntilEmpty}`
		];

		const approvalLines = [
			`**Starting approval:** ${projectionInput.startingApprovalPct}%`,
			`**Ending approval:** ${approvalEndPct}%`,
			`**Resource points:** ${result.resourcePoints.toLocaleString()}`
		];

		embed.addFields(
			{ name: 'Overview', value: overviewLines.join('\n'), inline: false },
			{ name: 'Coffer', value: cofferLines.join('\n'), inline: false },
			{ name: 'Progress', value: approvalLines.join('\n'), inline: false }
		);

		const entries = categoryResult ? Object.entries(categoryResult.evBank).sort((a, b) => b[1] - a[1]) : [];

		const chunks = splitExpectedValues(entries);

		if (chunks.length === 0) {
			embed.addFields({
				name: 'Expected quantities',
				value: 'No resources generated for the selected parameters.',
				inline: false
			});
		} else {
			chunks.forEach((chunk, index) => {
				embed.addFields({
					name: chunks.length === 1 ? 'Expected quantities' : `Expected quantities (${index + 1})`,
					value: chunk,
					inline: false
				});
			});
		}

		return { embeds: [embed] };
	}
});
