import { formatDuration, Time } from '@oldschoolgg/toolkit';
import { Bank, EItem, type Item, Items, resolveItems, toKMB } from 'oldschooljs';
import { clamp } from 'remeda';

import { TripError } from '@/lib/structures/TripError.js';
import type { AlchingActivityTaskOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

const unlimitedFireRuneProviders = resolveItems([
	'Staff of fire',
	'Fire battlestaff',
	'Mystic fire staff',
	'Lava battlestaff',
	'Mystic lava staff',
	'Steam battlestaff',
	'Mystic steam staff',
	'Smoke battlestaff',
	'Mystic smoke staff',
	'Tome of fire'
]);

const untradeableAlchableItemIDs = new Set<number>([EItem.RITE_OF_VILE_TRANSFERENCE]);
type AlchableItem = Item & { highalch: number };

// 5 tick action
export const timePerAlch = Time.Second * 3;
export const timePerAlchAgility = Time.Second * (3 + 10);

export function canAlchItem(item: Item): item is AlchableItem {
	return Boolean(item.highalch && (item.tradeable || untradeableAlchableItemIDs.has(item.id)));
}

export async function alchCommand(
	interaction: MInteraction | null,
	channelId: string,
	user: MUser,
	item: string,
	quantity: number | undefined
) {
	const userBank = user.bank;
	let osItem = Items.getItem(item);
	const maxTripLength = await user.calcMaxTripLength('Alching');
	const [favAlchs] = user.favAlchs(maxTripLength);
	if (!osItem) osItem = favAlchs;

	if (!osItem) throw new TripError('Invalid item.', [user.id]);
	if (!canAlchItem(osItem)) throw new TripError('This item cannot be alched.', [user.id]);

	if (user.skillsAsLevels.magic < 55) {
		throw new TripError('You need level 55 Magic to cast High Alchemy', [user.id]);
	}

	const maxCasts = Math.min(Math.floor(maxTripLength / timePerAlch), userBank.amount(osItem.id));

	if (!quantity) {
		quantity = maxCasts;
	}
	quantity = clamp(quantity, { min: 1, max: maxCasts });

	if (quantity * timePerAlch > maxTripLength || quantity < 1 || maxCasts < 1) {
		throw new TripError(`The max number of alchs you can do is ${maxCasts}!`, [user.id]);
	}

	const duration = quantity * timePerAlch;
	let fireRuneCost = quantity * 5;

	for (const runeProvider of unlimitedFireRuneProviders) {
		if (user.hasEquipped(runeProvider)) {
			fireRuneCost = 0;
			break;
		}
	}

	const alchValue = quantity * osItem.highalch;
	const consumedItems = new Bank().add(osItem.id, quantity).add('Nature rune', quantity);
	if (fireRuneCost > 0) {
		consumedItems.add('Fire rune', fireRuneCost);
	}

	if (!user.owns(consumedItems)) {
		throw new TripError(`You don't have the required items, you need ${consumedItems}`, [user.id]);
	}
	if (interaction) {
		await interaction.confirmation(
			`${user}, please confirm you want to alch ${quantity} ${osItem.name} (${toKMB(
				alchValue
			)}). This will take approximately ${formatDuration(duration)}, and consume ${consumedItems.clone().remove(osItem.id, quantity)}.`
		);
	}

	await user.transactItems({ itemsToRemove: consumedItems });
	await ClientSettings.updateBankSetting('magic_cost_bank', consumedItems);

	await ActivityManager.startTrip<AlchingActivityTaskOptions>({
		itemID: osItem.id,
		userID: user.id,
		channelId,
		quantity,
		duration,
		alchValue,
		type: 'Alching'
	});

	const response = `${user.minionName} is now alching ${quantity}x ${osItem.name}, it'll take around ${formatTripDuration(
		user,
		duration
	)} to finish.`;

	return response;
}
