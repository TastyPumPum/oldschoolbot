import { PerkTier, stringMatches, toTitleCase } from '@oldschoolgg/toolkit';
import { Monsters } from 'oldschooljs';

import { choicesOf } from '@/lib/discord/index.js';
import type { MUser } from '@/lib/MUser.js';
import { autoslayChoices, slayerMasterChoices } from '@/lib/slayer/constants.js';
import { slayerMasters } from '@/lib/slayer/slayerMasters.js';
import { SlayerRewardsShop } from '@/lib/slayer/slayerUnlocks.js';
import { getCommonTaskName } from '@/lib/slayer/slayerUtil.js';
import type { SlayerMaster, SlayerSkipSettings } from '@/lib/slayer/types.js';
import { autoSlayCommand } from '@/mahoji/lib/abstracted_commands/autoSlayCommand.js';
import {
	slayerShopBuyCommand,
	slayerShopListMyUnlocks,
	slayerShopListRewards
} from '@/mahoji/lib/abstracted_commands/slayerShopCommand.js';
import {
	slayerListBlocksCommand,
	slayerNewTaskCommand,
	slayerSkipTaskCommand,
	slayerStatusCommand,
	slayerUnblockCommand
} from '@/mahoji/lib/abstracted_commands/slayerTaskCommand.js';
import { patronMsg } from '@/mahoji/mahojiSettings.js';

const MAX_AUTOCOMPLETE_RESULTS = 25;

const slayerMonsterChoices = Array.from(
	new Map(
		slayerMasters
			.flatMap(master => master.tasks.map(task => [task.monster.id, getCommonTaskName(task.monster)] as const))
			.map(([id, name]) => [id, name])
	).entries()
).map(([, name]) => ({ name, value: name }));
slayerMonsterChoices.sort((a, b) => a.name.localeCompare(b.name));

function getMasterKey(master: SlayerMaster): string {
	return master.aliases[0];
}

function resolveSlayerMaster(input: string | undefined): SlayerMaster | null {
	if (!input) return null;
	return (
		slayerMasters.find(m => stringMatches(m.name, input) || m.aliases.some(alias => stringMatches(alias, input))) ??
		null
	);
}

function findTaskForMaster(master: SlayerMaster, monsterInput: string | undefined) {
	if (!monsterInput) return null;
	const task = master.tasks.find(taskOption => {
		if (stringMatches(taskOption.monster.name, monsterInput)) return true;
		if (stringMatches(getCommonTaskName(taskOption.monster), monsterInput)) return true;
		if (taskOption.monster.aliases?.some(alias => stringMatches(alias, monsterInput))) return true;
		return stringMatches(taskOption.monster.id.toString(), monsterInput);
	});
	if (!task) return null;
	return {
		task,
		monsterID: task.monster.id,
		monsterName: getCommonTaskName(task.monster)
	};
}

function getMasterSkipEntry(masterKey: string, monsterIDs: number[]) {
	const master =
		slayerMasters.find(
			m => getMasterKey(m) === masterKey || m.aliases.some(alias => stringMatches(alias, masterKey))
		) ?? null;
	const masterName = master?.name ?? toTitleCase(masterKey);
	const monsterNames = monsterIDs
		.map(id => {
			const taskFromMaster = master?.tasks.find(t => t.monster.id === id);
			if (taskFromMaster) {
				return getCommonTaskName(taskFromMaster.monster);
			}
			return Monsters.get(id)?.name ?? `Monster ${id}`;
		})
		.filter(Boolean);
	return { masterName, monsterNames };
}

function formatSkipList(settings: SlayerSkipSettings): string {
	const entries = Object.entries(settings);
	const populatedEntries = entries.filter(([, monsterIDs]) => monsterIDs.length > 0);
	if (populatedEntries.length === 0) {
		return "You don't have any Slayer skip entries yet.";
	}
	const lines: string[] = [];
	for (const [key, monsterIDs] of populatedEntries) {
		const { masterName, monsterNames } = getMasterSkipEntry(key, monsterIDs);
		lines.push(`${masterName}: ${monsterNames.join(', ')}`);
	}
	return lines.join('\n');
}

async function setSlayerAutoSkipBufferCommand(user: MUser, amount: number) {
	if (user.perkTier() < PerkTier.Two) {
		return patronMsg(PerkTier.Two);
	}
	if (amount < 0) {
		return 'Your buffer must be 0 or greater.';
	}
	await user.setSlayerAutoSkipBuffer(amount);
	if (amount === 0) {
		return 'Auto-skip Slayer point buffer cleared.';
	}
	return `Set your auto-skip Slayer point buffer to ${amount.toLocaleString()} points.`;
}

async function handleSlayerSkipListCommand({
	user,
	action,
	master: masterInput,
	monster: monsterInput
}: {
	user: MUser;
	action: 'add' | 'remove' | 'list';
	master?: string | null;
	monster?: string | null;
}) {
	if (user.perkTier() < PerkTier.Two) {
		return patronMsg(PerkTier.Two);
	}

	if (action === 'list') {
		return formatSkipList(user.getSlayerSkipSettings());
	}

	if (!masterInput) {
		return 'You need to specify a Slayer master.';
	}
	if (!monsterInput) {
		return 'You need to specify a monster.';
	}

	const master = resolveSlayerMaster(masterInput);
	if (!master) {
		return `Invalid Slayer master: ${masterInput}`;
	}

	const resolvedTask = findTaskForMaster(master, monsterInput);
	if (!resolvedTask) {
		return `${master.name} doesn't assign ${monsterInput}.`;
	}

	const masterKey = getMasterKey(master);
	const currentSettings = user.getSlayerSkipSettings();
	const currentMonsters = new Set(currentSettings[masterKey] ?? []);

	if (action === 'add') {
		currentMonsters.add(resolvedTask.monsterID);
		await user.updateSlayerSkipSettings(masterKey, [...currentMonsters]);
		const updatedSettings = user.getSlayerSkipSettings();
		const { masterName, monsterNames } = getMasterSkipEntry(masterKey, updatedSettings[masterKey] ?? []);
		const listSummary = monsterNames.length > 0 ? monsterNames.join(', ') : 'None';
		return `Added ${resolvedTask.monsterName} to ${master.name}'s skip list.\nCurrent skip list for ${masterName}: ${listSummary}`;
	}

	if (!currentMonsters.has(resolvedTask.monsterID)) {
		return `${resolvedTask.monsterName} wasn't on your ${master.name} skip list.`;
	}

	currentMonsters.delete(resolvedTask.monsterID);
	await user.updateSlayerSkipSettings(masterKey, [...currentMonsters]);
	return `Removed ${resolvedTask.monsterName} from ${master.name}'s skip list.`;
}

async function slayerMasterAutocomplete(value: string) {
	return slayerMasters
		.filter(
			master =>
				!value || stringMatches(master.name, value) || master.aliases.some(alias => stringMatches(alias, value))
		)
		.slice(0, MAX_AUTOCOMPLETE_RESULTS)
		.map(master => ({ name: master.name, value: getMasterKey(master) }));
}

async function slayerMonsterAutocomplete(value: string) {
	return slayerMonsterChoices
		.filter(choice => !value || stringMatches(choice.name, value))
		.slice(0, MAX_AUTOCOMPLETE_RESULTS);
}

export const slayerCommand = defineCommand({
	name: 'slayer',
	description: 'Slayer skill commands',
	options: [
		{
			type: 'Subcommand',
			name: 'autoslay',
			description: 'Send your minion to slay your current task.',
			options: [
				{
					type: 'String',
					name: 'mode',
					description: 'Which autoslay mode do you want?',
					required: false,
					choices: autoslayChoices
				},
				{
					type: 'Boolean',
					name: 'save',
					description: 'Save your choice as default',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'new_task',
			description: 'Send your minion to slay your current task.',
			options: [
				{
					type: 'String',
					name: 'master',
					description: 'Which Slayer master do you want a task from?',
					required: false,
					choices: slayerMasterChoices
				},
				{
					type: 'Boolean',
					name: 'save',
					description: 'Save your choice as default',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'manage',
			description: 'Manage your current Slayer task.',
			options: [
				{
					type: 'String',
					name: 'command',
					description: 'Skip your current task',
					required: true,
					choices: choicesOf(['skip', 'block', 'list_blocks'])
				},
				{
					type: 'Boolean',
					name: 'new',
					description: 'Get a new task (if applicable)',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'skip_list',
			description: 'Manage your Slayer skip list (Tier 2+ patrons).',
			options: [
				{
					type: 'String',
					name: 'action',
					description: 'What do you want to do?',
					required: true,
					choices: [
						{ name: 'Add', value: 'add' },
						{ name: 'Remove', value: 'remove' },
						{ name: 'List', value: 'list' }
					]
				},
				{
					type: 'String',
					name: 'master',
					description: 'Which Slayer master?',
					required: false,
					autocomplete: async (value: string) => slayerMasterAutocomplete(value)
				},
				{
					type: 'String',
					name: 'monster',
					description: 'Which monster?',
					required: false,
					autocomplete: async (value: string) => slayerMonsterAutocomplete(value)
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'skip_buffer',
			description: 'Set a Slayer point buffer for auto-skipping tasks (Tier 2+ patrons).',
			options: [
				{
					type: 'Integer',
					name: 'amount',
					description: 'Minimum Slayer points to keep when auto-skipping tasks.',
					required: true
				}
			]
		},
		{
			type: 'SubcommandGroup',
			name: 'rewards',
			description: 'Spend your Slayer rewards points.',
			options: [
				{
					type: 'Subcommand',
					name: 'unlock',
					description: 'Unlock tasks, extensions, cosmetics, etc',
					required: false,
					options: [
						{
							type: 'String',
							name: 'unlockable',
							description: 'Unlockable to purchase',
							required: true,
							autocomplete: async ({ value, user }: StringAutoComplete) => {
								const slayerUnlocks = SlayerRewardsShop.filter(
									r => !r.item && !user.user.slayer_unlocks.includes(r.id)
								);
								return slayerUnlocks
									.filter(r =>
										!value
											? true
											: r.name.toLowerCase().includes(value) ||
												r.aliases?.some(alias =>
													alias.toLowerCase().includes(value.toLowerCase())
												)
									)
									.map(m => {
										return { name: m.name, value: m.name };
									});
							}
						}
					]
				},
				{
					type: 'Subcommand',
					name: 'unblock',
					description: 'Unblock a task',
					required: false,
					options: [
						{
							type: 'String',
							name: 'assignment',
							description: 'Assignment to unblock',
							required: true,
							autocomplete: async ({ value, user }: StringAutoComplete) => {
								if (user.user.slayer_blocked_ids.length === 0) {
									return [{ name: "You don't have any monsters blocked", value: '' }];
								}
								const blockedMonsters = user.user.slayer_blocked_ids.map(
									mId => Monsters.find(m => m.id === mId)!
								);
								return blockedMonsters
									.filter(m => (!value ? true : m?.name.toLowerCase().includes(value.toLowerCase())))
									.map(m => {
										return { name: m?.name, value: m?.name };
									});
							}
						}
					]
				},
				{
					type: 'Subcommand',
					name: 'buy',
					description: 'Purchase something with points',
					required: false,
					options: [
						{
							type: 'String',
							name: 'item',
							description: 'Item to purchase',
							required: true,
							autocomplete: async ({ value }: StringAutoComplete) => {
								return SlayerRewardsShop.filter(
									r =>
										r.item &&
										(!value
											? true
											: r.name.toLowerCase().includes(value) ||
												r.aliases?.some(alias =>
													alias.toLowerCase().includes(value.toLowerCase())
												))
								).map(m => {
									return { name: m.name, value: m.name };
								});
							}
						},
						{
							type: 'Integer',
							name: 'quantity',
							description: 'The quantity to purchase, if applicable.',
							required: false,
							min_value: 1
						}
					]
				},
				{
					type: 'Subcommand',
					name: 'my_unlocks',
					description: 'Show purchased unlocks',
					required: false
				},
				{
					type: 'Subcommand',
					name: 'show_all_rewards',
					description: 'Show all rewards',
					required: false,
					options: [
						{
							type: 'String',
							name: 'type',
							description: 'What type of rewards to show?',
							required: false,
							choices: choicesOf(['all', 'buyables', 'unlocks'])
						}
					]
				},
				{
					type: 'Subcommand',
					name: 'disable',
					description: 'Disable unlocks, extensions, etc. They will need to be repurchased.',
					required: false,
					options: [
						{
							type: 'String',
							name: 'unlockable',
							description: 'Slayer unlock to disable',
							required: true,
							autocomplete: async ({ value, user }: StringAutoComplete) => {
								return SlayerRewardsShop.filter(
									r =>
										!r.item &&
										r.canBeRemoved &&
										user.user.slayer_unlocks.includes(r.id) &&
										(!value
											? true
											: r.name.toLowerCase().includes(value) ||
												r.aliases?.some(alias =>
													alias.toLowerCase().includes(value.toLowerCase())
												))
								).map(m => {
									return { name: m.name, value: m.name };
								});
							}
						}
					]
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'status',
			description: 'Shows status of current slayer task'
		}
	],
	run: async ({ options, user, interaction }) => {
		await interaction.defer();
		if (options.autoslay) {
			return autoSlayCommand({
				user,
				modeOverride: options.autoslay.mode,
				saveMode: Boolean(options.autoslay.save),
				interaction
			});
		}
		if (options.new_task) {
			return slayerNewTaskCommand({
				user,
				interaction,
				slayerMasterOverride: options.new_task.master,
				saveDefaultSlayerMaster: Boolean(options.new_task.save),
				showButtons: true
			});
		}
		if (options.manage) {
			if (options.manage.command === 'list_blocks') {
				return slayerListBlocksCommand(user);
			}
			if (options.manage.command === 'skip' || options.manage.command === 'block') {
				return slayerSkipTaskCommand({
					user,
					block: options.manage.command === 'block',
					newTask: Boolean(options.manage.new),
					interaction
				});
			}
		}
		if (options.skip_list) {
			return handleSlayerSkipListCommand({
				user,
				action: options.skip_list.action,
				master: options.skip_list.master,
				monster: options.skip_list.monster
			});
		}
		if (options.skip_buffer) {
			return setSlayerAutoSkipBufferCommand(user, options.skip_buffer.amount);
		}
		if (options.rewards) {
			if (options.rewards.my_unlocks) {
				return slayerShopListMyUnlocks(user);
			}
			if (options.rewards.unblock) {
				return slayerUnblockCommand(user, options.rewards.unblock.assignment);
			}
			if (options.rewards.show_all_rewards) {
				return slayerShopListRewards(options.rewards.show_all_rewards.type ?? 'all');
			}
			if (options.rewards.disable) {
				return slayerShopBuyCommand({
					user,
					disable: true,
					buyable: options.rewards.disable.unlockable,
					interaction
				});
			}
			if (options.rewards.buy) {
				return slayerShopBuyCommand({
					user,
					buyable: options.rewards.buy.item,
					quantity: options.rewards.buy.quantity,
					interaction
				});
			}
			if (options.rewards.unlock) {
				return slayerShopBuyCommand({
					user,
					buyable: options.rewards.unlock.unlockable,
					interaction
				});
			}
		}
		if (options.status) {
			return slayerStatusCommand(user);
		}
		return 'This should not happen. Please contact support.';
	}
});
