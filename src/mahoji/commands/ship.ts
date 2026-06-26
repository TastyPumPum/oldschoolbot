import { Events } from '@oldschoolgg/toolkit';
import { Bank, type Item, Items } from 'oldschooljs';

import { skillEmoji } from '@/lib/data/emojis.js';
import { BarracudaTrials, getBarracudaTrialProgress } from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import { SailingFacilities, SailingFacilitiesById } from '@/lib/skilling/skills/sailing/facilities.js';
import {
	formatStoredSalvage,
	removeStoredSalvage,
	SalvagingShipwreckById,
	type SalvagingShipwreckId,
	SalvagingShipwrecks
} from '@/lib/skilling/skills/sailing/salvaging.js';
import { getSeaChartingProgress } from '@/lib/skilling/skills/sailing/seaCharting.js';
import {
	getBarracudaTrialsProgress,
	getClamItem,
	getCompletedChartingTaskIds,
	getInstalledFacilities,
	getOrCreateUserShip,
	getStoredSalvage,
	updateUpgradesBank
} from '@/lib/skilling/skills/sailing/ship.js';
import { isTrawlingNetFacility } from '@/lib/skilling/skills/sailing/trawling.js';

export const shipCommand = defineCommand({
	name: 'ship',
	description: 'Manage your Sailing ship.',
	options: [
		{
			type: 'Subcommand',
			name: 'status',
			description: 'Show your ship status.'
		},
		{
			type: 'Subcommand',
			name: 'install',
			description: 'Install a ship facility.',
			options: [
				{
					type: 'String',
					name: 'facility',
					description: 'The facility to install.',
					required: true,
					choices: SailingFacilities.map(f => ({ name: f.name, value: f.id }))
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'sort_salvage',
			description: 'Sort stored shipwreck salvage for Sailing XP.',
			options: [
				{
					type: 'String',
					name: 'type',
					description: 'The salvage type to sort. Leave empty to sort all stored salvage.',
					required: false,
					choices: SalvagingShipwrecks.map(shipwreck => ({
						name: shipwreck.salvageName,
						value: shipwreck.id
					}))
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The amount of this salvage to sort.',
					required: false,
					min_value: 1
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'clam',
			description: 'Feed the giant clam an item or check its status.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'A tradeable, alchable item to feed the clam.',
					required: false,
					autocomplete: async ({ value }: StringAutoComplete) => {
						if (!value) return [{ name: 'Type something!', value: Items.getId('Coins').toString() }];
						return Array.from(
							Items.filter(item => item.name.toLowerCase().includes(value.toLowerCase())).values()
						)
							.slice(0, 25)
							.map(item => ({ name: `${item.name} (ID: ${item.id})`, value: item.id.toString() }));
					}
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'rename',
			description: 'Rename your ship.',
			options: [
				{
					type: 'String',
					name: 'name',
					description: 'The new ship name.',
					required: true
				}
			]
		}
	],
	run: async ({ options, user }) => {
		const ship = await getOrCreateUserShip(user.id);

		if (options.status) {
			const name = ship.ship_name ?? 'Unnamed ship';
			const facilities = getInstalledFacilities(ship).map(f => SailingFacilitiesById.get(f)?.name ?? f);
			const storedSalvage = formatStoredSalvage(getStoredSalvage(ship));
			const chartingProgress = getSeaChartingProgress(getCompletedChartingTaskIds(ship));
			const chartingStatus = chartingProgress.oceans
				.map(ocean => `${ocean.ocean}: ${ocean.completed.toLocaleString()}/${ocean.total.toLocaleString()}`)
				.join('\n');
			const barracudaProgress = getBarracudaTrialsProgress(ship);
			const barracudaStatus = BarracudaTrials.map(trial => {
				const progress = getBarracudaTrialProgress(barracudaProgress, trial.id);
				const ranks =
					progress.completedRanks.length === 0
						? 'None'
						: trial.ranks
								.filter(rank => progress.completedRanks.includes(rank.id))
								.map(rank => rank.name)
								.join(', ');
				return `${trial.name}: ${ranks}`;
			}).join('\n');

			return `**${name}**\nFacilities: ${facilities.length === 0 ? 'None' : facilities.join(', ')}\nStored salvage: ${storedSalvage}\n\nCharting progress (${chartingProgress.completed.toLocaleString()}/${chartingProgress.total.toLocaleString()}):\n${chartingStatus}\n\nBarracuda Trials:\n${barracudaStatus}`;
		}

		if (options.sort_salvage) {
			if (await user.minionIsBusy()) return `${user.minionName} is busy.`;

			const stored = getStoredSalvage(ship);
			const salvageType = options.sort_salvage.type as SalvagingShipwreckId | undefined;
			const quantityInput = options.sort_salvage.quantity;

			if (!salvageType && quantityInput) {
				return 'Choose a salvage type when sorting a specific quantity.';
			}

			const entries = salvageType
				? [
						[
							salvageType,
							Math.min(quantityInput ?? stored[salvageType] ?? 0, stored[salvageType] ?? 0)
						] as const
					]
				: SalvagingShipwrecks.map(shipwreck => [shipwreck.id, stored[shipwreck.id] ?? 0] as const);

			const salvageToSort = entries.filter(([, quantity]) => quantity > 0);
			if (salvageToSort.length === 0) {
				return salvageType
					? `You don't have any ${SalvagingShipwreckById.get(salvageType)?.salvageName ?? 'salvage'} stored.`
					: "You don't have any stored salvage to sort.";
			}

			let nextStored = stored;
			let xpReceived = 0;
			const loot = new Bank();
			const sortedParts: string[] = [];
			for (const [shipwreckId, quantity] of salvageToSort) {
				const shipwreck = SalvagingShipwreckById.get(shipwreckId);
				if (!shipwreck) continue;
				nextStored = removeStoredSalvage(nextStored, shipwreckId, quantity);
				xpReceived += quantity * shipwreck.sortingXP;
				loot.add(shipwreck.lootTable.roll(quantity));
				sortedParts.push(`${quantity.toLocaleString()}x ${shipwreck.salvageName}`);
			}
			const ownsSoup = user.owns('Soup');
			const soupQuantity = loot.amount('Soup');
			const receivedSoup = !ownsSoup && soupQuantity > 0;
			if (ownsSoup && soupQuantity > 0) {
				loot.remove('Soup', soupQuantity);
			} else if (soupQuantity > 1) {
				loot.remove('Soup', soupQuantity - 1);
			}

			await updateUpgradesBank(user.id, { salvage: nextStored });
			const xpRes = await user.addXP({
				skillName: 'sailing',
				amount: xpReceived
			});

			if (loot.length > 0) {
				await user.transactItems({ itemsToAdd: loot, collectionLog: true });
			}
			if (receivedSoup) {
				globalClient.emit(
					Events.ServerNotification,
					`${skillEmoji.sailing} **${user.badgedUsername}'s** minion, ${user.minionName}, just received Soup while sorting salvage!`
				);
			}

			return `Sorted ${sortedParts.join(', ')}. ${xpRes}${loot.length > 0 ? `\nYou received: ${loot}.` : ''}`;
		}

		if (options.clam) {
			const stored = getClamItem(ship);
			const itemInput = options.clam.item?.trim();
			if (!itemInput) {
				if (!stored.itemId) return 'You have not prepared an item for the giant clam.';
				const readyAt = (stored.fedAt ?? Date.now()) + 60 * 60 * 1000;
				const ready = Date.now() >= readyAt;
				return `Prepared item: ${Items.get(stored.itemId)?.name ?? stored.itemId}. It is ${ready ? 'ready' : 'still being polished'} for the next giant clam encounter.`;
			}
			if (user.skillsAsLevels.sailing < 40) {
				return `${user.minionName} needs 40 Sailing to use the giant clam.`;
			}
			if (stored.itemId) {
				return 'The giant clam is already polishing an item.';
			}

			let item: Item;
			try {
				item = Items.getOrThrow(itemInput);
			} catch {
				return 'That is not a valid item.';
			}
			if ((!item.tradeable && !item.tradeable_on_ge) || (!item.highalch && item.name !== 'Coins')) {
				return 'The giant clam only accepts tradeable, alchable items.';
			}
			const cost = new Bank().add(item.id);
			if (!user.owns(cost)) return `You don't have a ${item.name}.`;

			await user.transactItems({ itemsToRemove: cost });
			await updateUpgradesBank(user.id, { clamItemId: item.id, clamFedAt: Date.now() });
			return `Prepared a ${item.name} for the giant clam. It can produce a pearl after at least one hour and a future ocean encounter.`;
		}

		if (options.install) {
			const facility = SailingFacilitiesById.get(options.install.facility);
			if (!facility) return 'Unknown facility.';
			if (user.skillsAsLevels.sailing < facility.level) {
				return `${user.minionName} needs ${facility.level} Sailing to install ${facility.name}.`;
			}
			if (facility.constructionLevel && user.skillsAsLevels.construction < facility.constructionLevel) {
				return `${user.minionName} needs ${facility.constructionLevel} Construction to install ${facility.name}.`;
			}

			const installed = getInstalledFacilities(ship);
			if (installed.includes(facility.id)) {
				return `${facility.name} is already installed.`;
			}

			if (facility.requiredItems && !user.owns(facility.requiredItems)) {
				return `You need to own ${facility.requiredItems} to install ${facility.name}.`;
			}

			if (!user.owns(facility.cost)) {
				return `You don't have the required items to install ${facility.name}.\nYou need: ${facility.cost}.`;
			}

			await user.transactItems({
				itemsToRemove: facility.cost
			});

			const facilitiesToKeep = isTrawlingNetFacility(facility.id)
				? installed.filter(installedFacility => !isTrawlingNetFacility(installedFacility))
				: facility.id === 'wind_catcher' || facility.id === 'gale_catcher'
					? installed.filter(
							installedFacility =>
								installedFacility !== 'wind_catcher' && installedFacility !== 'gale_catcher'
						)
					: installed;
			await updateUpgradesBank(user.id, {
				facilities: [...facilitiesToKeep, facility.id]
			});

			return `Installed ${facility.name}.`;
		}

		if (options.rename) {
			const newName = options.rename.name.trim();
			if (newName.length < 2 || newName.length > 32) {
				return 'Ship name must be between 2 and 32 characters.';
			}
			await prisma.userShip.update({
				where: { user_id: user.id },
				data: { ship_name: newName }
			});
			return `Your ship has been renamed to **${newName}**.`;
		}

		return 'Invalid command.';
	}
});
