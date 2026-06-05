import { Bank, type Item, Items } from 'oldschooljs';

import { BarracudaTrials, getBarracudaTrialProgress } from '@/lib/skilling/skills/sailing/barracudaTrials.js';
import { SailingFacilities, SailingFacilitiesById } from '@/lib/skilling/skills/sailing/facilities.js';
import {
	formatStoredSalvage,
	removeStoredSalvage,
	SalvagingShipwreckById,
	type SalvagingShipwreckId,
	SalvagingShipwrecks
} from '@/lib/skilling/skills/sailing/salvaging.js';
import {
	getBarracudaTrialsProgress,
	getClamItemId,
	getInstalledFacilities,
	getOrCreateUserShip,
	getShipBonusesFromSnapshot,
	getShipPartTier,
	getStoredSalvage,
	snapshotShip,
	updateUpgradesBank
} from '@/lib/skilling/skills/sailing/ship.js';
import {
	getShipUpgradeCost,
	MAX_SHIP_TIER,
	SHIP_PARTS,
	type ShipPart
} from '@/lib/skilling/skills/sailing/upgrades.js';

const prettyPartName: Record<ShipPart, string> = {
	hull: 'Hull',
	sails: 'Sails',
	crew: 'Crew',
	navigation: 'Navigation',
	cargo: 'Cargo'
};

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
			name: 'clam',
			description: 'Feed the giant clam an item or check its status.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The item to feed the clam (tradeable). Leave empty to check status.',
					required: false,
					autocomplete: async ({ value }: StringAutoComplete) => {
						if (!value) return [{ name: 'Type something!', value: Items.getId('Coins').toString() }];
						return Array.from(
							Items.filter(item => item.name.toLowerCase().includes(value.toLowerCase())).values()
						)
							.slice(0, 25)
							.map(i => ({
								name: `${i.name} (ID: ${i.id})`,
								value: i.id.toString()
							}));
					}
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
			name: 'upgrade',
			description: 'Upgrade a ship part.',
			options: [
				{
					type: 'String',
					name: 'part',
					description: 'The part to upgrade.',
					required: true,
					choices: SHIP_PARTS.map(part => ({ name: prettyPartName[part], value: part }))
				},
				{
					type: 'Integer',
					name: 'tiers',
					description: 'How many tiers to upgrade (default 1).',
					required: false,
					min_value: 1,
					max_value: MAX_SHIP_TIER
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
			const snapshot = snapshotShip(ship);
			const bonuses = getShipBonusesFromSnapshot(snapshot);
			const name = ship.ship_name ?? 'Unnamed ship';
			const facilities = getInstalledFacilities(ship).map(f => SailingFacilitiesById.get(f)?.name ?? f);
			const storedSalvage = formatStoredSalvage(getStoredSalvage(ship));
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

			return `**${name}**\nHull: ${ship.hull_tier}/${MAX_SHIP_TIER}\nSails: ${ship.sails_tier}/${MAX_SHIP_TIER}\nCrew: ${ship.crew_tier}/${MAX_SHIP_TIER}\nNavigation: ${ship.navigation_tier}/${MAX_SHIP_TIER}\nCargo: ${ship.cargo_tier}/${MAX_SHIP_TIER}\n\nFacilities: ${facilities.length === 0 ? 'None' : facilities.join(', ')}\nStored salvage: ${storedSalvage}\n\nBarracuda Trials:\n${barracudaStatus}\n\nBonuses:\nSpeed: ${Math.round((1 - bonuses.speedMultiplier) * 100)}%\nSuccess: ${Math.round(bonuses.successBonus * 100)}%\nLoot: ${Math.round(bonuses.lootBonus * 100)}%`;
		}

		if (options.clam) {
			const stored = getClamItemId(ship);
			const itemInput = options.clam.item?.trim();

			if (!itemInput) {
				return stored
					? `Your giant clam is holding: ${Items.get(stored)?.name ?? stored}.`
					: 'Your giant clam is not holding any item yet.';
			}

			if (user.skillsAsLevels.sailing < 40) {
				return `${user.minionName} needs 40 Sailing to feed the giant clam.`;
			}

			if (stored) {
				return 'Your giant clam is already holding an item. You must claim its pearl before feeding another.';
			}

			let item: Item;
			try {
				item = Items.getOrThrow(itemInput);
			} catch {
				return 'That is not a valid item.';
			}

			if (!item.tradeable && !item.tradeable_on_ge) {
				return 'The giant clam only accepts tradeable items.';
			}

			const cost = new Bank().add(item.id, 1);
			if (!user.owns(cost)) {
				return `You don't have any ${item.name}.`;
			}

			await user.transactItems({ itemsToRemove: cost });
			await updateUpgradesBank(user.id, { clamItemId: item.id });

			return `You fed the giant clam a ${item.name}. It will return a pearl on your next encounter.`;
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
			const sortedParts: string[] = [];
			for (const [shipwreckId, quantity] of salvageToSort) {
				const shipwreck = SalvagingShipwreckById.get(shipwreckId);
				if (!shipwreck) continue;
				nextStored = removeStoredSalvage(nextStored, shipwreckId, quantity);
				xpReceived += quantity * shipwreck.sortingXP;
				sortedParts.push(`${quantity.toLocaleString()}x ${shipwreck.salvageName}`);
			}

			await updateUpgradesBank(user.id, { salvage: nextStored });
			const xpRes = await user.addXP({
				skillName: 'sailing',
				amount: xpReceived
			});

			return `Sorted ${sortedParts.join(', ')}. ${xpRes}`;
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

			await updateUpgradesBank(user.id, {
				facilities: [...installed, facility.id]
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

		if (options.upgrade) {
			const part = options.upgrade.part as ShipPart;
			const currentTier = getShipPartTier(ship, part);
			const tiersRequested = options.upgrade.tiers ?? 1;
			const targetTier = Math.min(MAX_SHIP_TIER, currentTier + tiersRequested);

			if (currentTier >= MAX_SHIP_TIER) {
				return `${prettyPartName[part]} is already at max tier.`;
			}
			if (targetTier === currentTier) {
				return 'Invalid tier selection.';
			}

			const cost = getShipUpgradeCost(part, currentTier, targetTier);

			if (!user.owns(cost)) {
				return `You don't have the required items to upgrade ${prettyPartName[part]} to tier ${targetTier}.\nYou need: ${cost}.`;
			}

			await user.transactItems({
				itemsToRemove: cost
			});

			const updateData: Record<string, number> = {};
			updateData[`${part}_tier`] = targetTier;

			await prisma.userShip.update({
				where: { user_id: user.id },
				data: updateData
			});

			return `Upgraded ${prettyPartName[part]} to tier ${targetTier}. Cost: ${cost}.`;
		}

		return 'Invalid command.';
	}
});
