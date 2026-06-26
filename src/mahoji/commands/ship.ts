import { Events } from '@oldschoolgg/toolkit';
import { Bank, type Item, Items } from 'oldschooljs';

import { skillEmoji } from '@/lib/data/emojis.js';
import { BarracudaTrials, getBarracudaTrialProgress } from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import {
	isSalvagingHookFacility,
	SailingFacilities,
	SailingFacilitiesById,
	type SailingFacilityId
} from '@/lib/skilling/skills/sailing/facilities.js';
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
	getShipParts,
	getStoredSalvage,
	updateUpgradesBank
} from '@/lib/skilling/skills/sailing/ship.js';
import {
	bankFromSailingCost,
	getInstalledStructuralPart,
	normaliseShipParts,
	type SailingShipType,
	SailingShipTypeById,
	SailingStructuralParts,
	type SailingStructuralSlot,
	type SailingStructuralTier
} from '@/lib/skilling/skills/sailing/shipParts.js';
import { isTrawlingNetFacility } from '@/lib/skilling/skills/sailing/trawling.js';

type SailingFacilityInstallType = 'hook' | 'net' | 'catcher' | 'station';

const facilityInstallTypeChoices: Array<{ name: string; value: SailingFacilityInstallType }> = [
	{ name: 'Salvaging hook', value: 'hook' },
	{ name: 'Trawling net', value: 'net' },
	{ name: 'Wind catcher', value: 'catcher' },
	{ name: 'Station/utility', value: 'station' }
];

const structuralTierChoices = [
	{ name: 'Wooden', value: 'wooden' },
	{ name: 'Oak', value: 'oak' },
	{ name: 'Teak', value: 'teak' },
	{ name: 'Mahogany', value: 'mahogany' },
	{ name: 'Camphor', value: 'camphor' },
	{ name: 'Ironwood', value: 'ironwood' },
	{ name: 'Rosewood', value: 'rosewood' },
	{ name: 'Bronze', value: 'bronze' },
	{ name: 'Iron', value: 'iron' },
	{ name: 'Steel', value: 'steel' },
	{ name: 'Mithril', value: 'mithril' },
	{ name: 'Adamant', value: 'adamant' },
	{ name: 'Rune', value: 'rune' },
	{ name: 'Dragon', value: 'dragon' },
	{ name: 'Wooden mast and linen sails', value: 'wooden_linen' },
	{ name: 'Oak mast and linen sails', value: 'oak_linen' },
	{ name: 'Teak mast and canvas sails', value: 'teak_canvas' },
	{ name: 'Mahogany mast and canvas sails', value: 'mahogany_canvas' },
	{ name: 'Camphor mast and canvas sails', value: 'camphor_canvas' },
	{ name: 'Ironwood mast and cotton sails', value: 'ironwood_cotton' },
	{ name: 'Rosewood mast and cotton sails', value: 'rosewood_cotton' }
];

function formatStructuralParts(parts: ReturnType<typeof normaliseShipParts>) {
	const installed = (['hull', 'helm', 'keel', 'mast_sails'] as SailingStructuralSlot[])
		.map(slot => getInstalledStructuralPart(parts, slot))
		.filter(part => part !== null && part !== undefined)
		.map(part => part.name);
	return installed.join(', ');
}

function getFacilityInstallType(facilityID: string): SailingFacilityInstallType {
	if (isSalvagingHookFacility(facilityID as never)) return 'hook';
	if (isTrawlingNetFacility(facilityID as never)) return 'net';
	if (facilityID === 'wind_catcher' || facilityID === 'gale_catcher') return 'catcher';
	return 'station';
}

function getInstallTypeFromAutocompleteOptions(rawOptions: StringAutoComplete['rawOptions']) {
	const installCommand = rawOptions?.find(option => option.name === 'install');
	if (!installCommand || !('options' in installCommand)) return undefined;
	const installOptions = installCommand.options;
	const typeOption = installOptions?.find(option => option.name === 'type');
	return typeOption && 'value' in typeOption
		? (typeOption.value as SailingFacilityInstallType | undefined)
		: undefined;
}

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
					name: 'type',
					description: 'The type of facility to install.',
					required: true,
					choices: facilityInstallTypeChoices
				},
				{
					type: 'String',
					name: 'variant',
					description: 'The specific facility variant to install.',
					required: true,
					autocomplete: async ({ value, rawOptions }: StringAutoComplete) => {
						const selectedType = getInstallTypeFromAutocompleteOptions(rawOptions);
						const matches = SailingFacilities.filter(facility => {
							if (selectedType && getFacilityInstallType(facility.id) !== selectedType) return false;
							return facility.name.toLowerCase().includes(value.toLowerCase());
						});
						return matches.map(facility => ({ name: facility.name, value: facility.id }));
					}
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'install_part',
			description: 'Install a structural ship part.',
			options: [
				{
					type: 'String',
					name: 'slot',
					description: 'The structural slot to install into.',
					required: true,
					choices: [
						{ name: 'Hull', value: 'hull' },
						{ name: 'Helm', value: 'helm' },
						{ name: 'Keel', value: 'keel' },
						{ name: 'Mast and sails', value: 'mast_sails' }
					]
				},
				{
					type: 'String',
					name: 'tier',
					description: 'The part tier to install.',
					required: true,
					choices: structuralTierChoices
				},
				{
					type: 'String',
					name: 'ship_type',
					description: 'The ship type for hull installs.',
					required: false,
					choices: [
						{ name: 'Raft', value: 'raft' },
						{ name: 'Skiff', value: 'skiff' },
						{ name: 'Sloop', value: 'sloop' }
					]
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
			const parts = normaliseShipParts(getShipParts(ship));
			const shipType = SailingShipTypeById.get(parts.shipType ?? 'raft')!;
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

			return `**${name}**\nShip type: ${shipType.name} (${shipType.facilityHotspots} facility hotspots)\nStructural parts: ${formatStructuralParts(parts)}\nFacilities: ${facilities.length === 0 ? 'None' : facilities.join(', ')}\nStored salvage: ${storedSalvage}\n\nCharting progress (${chartingProgress.completed.toLocaleString()}/${chartingProgress.total.toLocaleString()}):\n${chartingStatus}\n\nBarracuda Trials:\n${barracudaStatus}`;
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

		if (options.install_part) {
			const slot = options.install_part.slot as SailingStructuralSlot;
			const tier = options.install_part.tier as SailingStructuralTier;
			const currentParts = normaliseShipParts(getShipParts(ship));
			const shipType =
				slot === 'hull'
					? ((options.install_part.ship_type as SailingShipType | undefined) ??
						currentParts.shipType ??
						'raft')
					: (currentParts.shipType ?? 'raft');
			const shipTypeDefinition = SailingShipTypeById.get(shipType);
			if (!shipTypeDefinition) return 'That is not a valid ship type.';
			if (!shipTypeDefinition.structuralSlots.includes(slot)) {
				return `${shipTypeDefinition.name} ships cannot have a ${slot.replace('_', ' ')} part.`;
			}

			const part = SailingStructuralParts.find(
				structuralPart =>
					structuralPart.slot === slot && structuralPart.shipType === shipType && structuralPart.tier === tier
			);
			if (!part) return 'That is not a valid structural part for that ship type.';
			if (user.skillsAsLevels.sailing < shipTypeDefinition.sailingLevel) {
				return `${user.minionName} needs ${shipTypeDefinition.sailingLevel} Sailing to use a ${shipTypeDefinition.name}.`;
			}
			if (user.skillsAsLevels.sailing < part.level) {
				return `${user.minionName} needs ${part.level} Sailing to install ${part.name}.`;
			}
			if (user.skillsAsLevels.construction < part.constructionLevel) {
				return `${user.minionName} needs ${part.constructionLevel} Construction to install ${part.name}.`;
			}
			if (currentParts.shipType === shipType && currentParts[slot] === tier) {
				return `${part.name} is already installed.`;
			}

			const { bank: cost, missingItems } = bankFromSailingCost(part.cost);
			if (cost.length > 0 && !user.owns(cost)) {
				return `You don't have the required items to install ${part.name}.\nYou need: ${cost}.`;
			}
			if (cost.length > 0) {
				await user.transactItems({ itemsToRemove: cost });
			}

			const nextParts = {
				...currentParts,
				shipType,
				[slot]: tier,
				keel: shipType === 'raft' ? undefined : currentParts.keel
			};
			if (slot === 'keel') {
				nextParts.keel = tier as typeof nextParts.keel;
			}
			await updateUpgradesBank(user.id, { parts: nextParts });

			const missingCostMessage =
				missingItems.length > 0
					? `\nRecipe items not charged because they are not in the current item data: ${missingItems.join(', ')}.`
					: '';
			return `Installed ${part.name}.${missingCostMessage}`;
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
			const facilityType = options.install.type as SailingFacilityInstallType;
			const facility = SailingFacilitiesById.get(options.install.variant as SailingFacilityId);
			if (!facility) return 'Unknown facility.';
			if (getFacilityInstallType(facility.id) !== facilityType) {
				return `${facility.name} is not a valid ${facilityInstallTypeChoices.find(choice => choice.value === facilityType)?.name ?? facilityType} facility.`;
			}
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
				: isSalvagingHookFacility(facility.id)
					? installed.filter(installedFacility => !isSalvagingHookFacility(installedFacility))
					: facility.id === 'wind_catcher' || facility.id === 'gale_catcher'
						? installed.filter(
								installedFacility =>
									installedFacility !== 'wind_catcher' && installedFacility !== 'gale_catcher'
							)
						: installed;
			const shipType = SailingShipTypeById.get(normaliseShipParts(getShipParts(ship)).shipType ?? 'raft')!;
			if (facilitiesToKeep.length + 1 > shipType.facilityHotspots) {
				return `${shipType.name} ships only have ${shipType.facilityHotspots} facility hotspot${shipType.facilityHotspots === 1 ? '' : 's'}. Upgrade your hull to a larger ship type first.`;
			}
			await updateUpgradesBank(user.id, {
				facilities: [...facilitiesToKeep, facility.id]
			});

			const missingCostMessage = facility.missingCostItems?.length
				? `\nRecipe items not charged because they are not in the current item data: ${facility.missingCostItems.join(', ')}.`
				: '';
			return `Installed ${facility.name}.${missingCostMessage}`;
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
