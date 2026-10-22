import { EmbedBuilder } from '@oldschoolgg/discord';
import { formatDuration } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { userIsBusy } from '@/lib/cache.js';
import { calculateUserGearPercents } from '@/lib/data/cox.js';
import { degradeableItems, degradeChargeBank } from '@/lib/degradeableItems.js';
import { trackLoot } from '@/lib/lootTrack.js';
import {
	resolveTFARoute,
	simulateTFARaid,
	TFA_BALANCING,
	TFA_PROVISIONAL_MESSAGE,
	TFABosses,
	TFAPendingRewards,
	type TFARouteChoices,
	type TFATeamMember,
	TFAUniques,
	tfaDeathChance,
	tfaRaidDuration
} from '@/lib/simulation/tfa.js';
import { ChargeBank } from '@/lib/structures/Bank.js';
import type { MakePartyOptions } from '@/lib/types/index.js';
import type { FracturedArchiveTaskOptions } from '@/lib/types/minions.js';
import { determineRunes } from '@/lib/util/determineRunes.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { formatSkillRequirements } from '@/lib/util/smallUtils.js';

const rangedBows = ['Twisted bow', 'Venator bow'];
const rangedCrossbows = ['Dragon hunter crossbow', 'Armadyl crossbow', 'Zaryte crossbow'];
const arrows = ['Rune arrow', 'Amethyst arrow', 'Dragon arrow'];
const bolts = ['Ruby bolts (e)', 'Diamond bolts (e)', 'Ruby dragon bolts (e)', 'Diamond dragon bolts (e)'];
const mageWeapons = ['Trident of the swamp', 'Sanguinesti staff', "Tumeken's shadow", 'Kodai wand', 'Eye of ayak'];

// PROVISIONAL supply/charge costs, comparable to ToB with a little extra food for getting lost.
function tfaInput(user: MUser, kc: number, quantity: number, deathFeeReserved: number) {
	const cost = new Bank()
		.add('Super combat potion(4)')
		.add('Ranging potion(4)')
		.add('Stamina potion(4)')
		.add('Saradomin brew(4)', Math.max(2, 8 - Math.floor(kc / 20)))
		.add('Super restore(4)', 3)
		.add('Shark', 6)
		.add(determineRunes(user, new Bank().add('Blood rune', 150).add('Death rune', 100).add('Water rune', 600)));
	const range = user.gear.range;
	if (range.hasEquipped('Toxic blowpipe')) {
		const blowpipe = user.getBlowpipe();
		if (blowpipe.dartID) cost.add(blowpipe.dartID, TFA_BALANCING.ammunitionPerRaid);
	} else if (!range.hasEquipped('Bow of faerdhinen (c)')) {
		const ammo = range.get('ammo');
		if (ammo) cost.add(ammo.item, TFA_BALANCING.ammunitionPerRaid);
	}
	cost.multiply(quantity).add('Coins', deathFeeReserved * quantity);
	const charges = new ChargeBank();
	for (const item of degradeableItems) {
		if (!['melee', 'range', 'mage'].includes(item.setup) || !user.gear[item.setup].hasEquipped(item.item.id))
			continue;
		charges.add(
			item.settingsKey,
			(item.settingsKey === 'serp_helm_charges'
				? TFA_BALANCING.serpHelmChargesPerRaid
				: TFA_BALANCING.itemChargesPerRaid) * quantity
		);
	}
	return { cost, charges };
}

export async function checkTFAUser(user: MUser, quantity = 1): Promise<[false] | [true, string]> {
	if (!user.hasMinion) return [true, `${user.usernameOrMention} needs a minion to get lost in the Archive.`];
	if (await user.minionIsBusy()) return [true, `${user.usernameOrMention}'s minion is busy.`];
	if (!user.hasSkillReqs(TFA_BALANCING.skills)) {
		return [true, `${user.usernameOrMention} needs ${formatSkillRequirements(TFA_BALANCING.skills)}.`];
	}
	// While Guthix Sleeps is represented by a QP requirement, as with other quest-locked PvM.
	if (user.QP < TFA_BALANCING.questPoints) {
		return [
			true,
			`${user.usernameOrMention} needs ${TFA_BALANCING.questPoints} quest points to access the Archive.`
		];
	}
	if (!user.gear.melee.equippedWeapon()) {
		return [
			true,
			`${user.usernameOrMention} needs a melee weapon equipped. If it ran out of charges, recharge and re-equip the uncharged weapon from your bank.`
		];
	}
	if (!user.gear.mage.hasEquipped(mageWeapons)) {
		return [
			true,
			`${user.usernameOrMention} needs a charged trident, Sanguinesti staff, Tumeken's shadow, Eye of ayak or Kodai wand in their mage setup. If it ran out of charges, recharge and re-equip the uncharged weapon from your bank.`
		];
	}
	const range = user.gear.range;
	if (!range.hasEquipped([...rangedBows, ...rangedCrossbows, 'Bow of faerdhinen (c)', 'Toxic blowpipe'])) {
		return [
			true,
			`${user.usernameOrMention} needs a Twisted/Venator bow, Bow of faerdhinen (c), charged Toxic blowpipe or a dragon hunter/Armadyl/Zaryte crossbow in their range setup.`
		];
	}
	const gear = calculateUserGearPercents(user);
	if ([gear.melee, gear.range, gear.mage].some(i => i < TFA_BALANCING.minimumGearPercent)) {
		return [
			true,
			`${user.usernameOrMention} needs at least ${TFA_BALANCING.minimumGearPercent}% gear score in each combat setup. Even a confused minion needs decent gear.`
		];
	}
	if (range.hasEquipped(rangedBows) && !range.hasEquipped(arrows)) {
		return [true, `${user.usernameOrMention} needs rune, amethyst or dragon arrows equipped.`];
	}
	if (range.hasEquipped(rangedCrossbows) && !range.hasEquipped(bolts)) {
		return [true, `${user.usernameOrMention} needs enchanted ruby or diamond bolts equipped.`];
	}
	if (
		range.hasEquipped([...rangedBows, ...rangedCrossbows]) &&
		(range.get('ammo')?.quantity ?? 0) < TFA_BALANCING.ammunitionPerRaid * quantity
	) {
		return [
			true,
			`${user.usernameOrMention} needs at least ${TFA_BALANCING.ammunitionPerRaid * quantity} arrows or bolts equipped.`
		];
	}
	if (range.hasEquipped('Toxic blowpipe')) {
		const blowpipe = user.getBlowpipe();
		if (!blowpipe.dartID || !blowpipe.dartQuantity || !blowpipe.scales) {
			return [true, `${user.usernameOrMention} needs darts and scales in their Toxic blowpipe.`];
		}
		if (
			blowpipe.dartQuantity < TFA_BALANCING.ammunitionPerRaid * quantity ||
			blowpipe.scales < TFA_BALANCING.blowpipeScalesPerRaid * quantity
		) {
			return [
				true,
				`${user.usernameOrMention} needs at least ${TFA_BALANCING.ammunitionPerRaid * quantity} darts and ${TFA_BALANCING.blowpipeScalesPerRaid * quantity} scales in their Toxic blowpipe.`
			];
		}
	}
	const kc = await user.fetchMinigameScore('fractured_archive');
	const { cost, charges } = tfaInput(user, kc, quantity, TFA_BALANCING.deathFee);
	const chargeCheck = user.hasCharges(charges);
	if (!chargeCheck.hasCharges) return [true, `${user.usernameOrMention}: ${chargeCheck.fullUserString}`];
	try {
		// Preflight the same removal used at departure, including equipped ammunition and blowpipe supplies.
		user.calculateSpecialRemoveItems(cost);
	} catch (err) {
		return [true, `${user.usernameOrMention}: ${(err as Error).message}`];
	}
	return [false];
}

export async function tfaCheckCommand(user: MUser) {
	const result = await checkTFAUser(user);
	return result[0]
		? `You aren't ready for TFA: ${result[1]}`
		: `You are ready for the Fractured Archive. Your minion strongly disagrees.\n${TFA_PROVISIONAL_MESSAGE}`;
}

export async function tfaStatsCommand(user: MUser) {
	const [kc, stats] = await Promise.all([user.fetchMinigameScore('fractured_archive'), user.fetchStats()]);
	const gear = calculateUserGearPercents(user);
	const member: TFATeamMember = { id: user.id, kc, attempts: stats.tfa_attempts, gear };
	const deaths = Object.entries(TFABosses).map(
		([boss, room]) => `${room.name}: ${tfaDeathChance(member, boss as keyof typeof TFABosses, false).toFixed(1)}%`
	);
	const embed = new EmbedBuilder()
		.setTitle('The Fractured Archive')
		.setDescription(TFA_PROVISIONAL_MESSAGE)
		.addFields([
			{
				name: 'Stats',
				value: `${kc} completions, ${stats.tfa_attempts} attempts, ${stats.tfa_deaths} deaths, ${TFAUniques.reduce((sum, id) => sum + user.cl.amount(id), 0)} uniques.`
			},
			{
				name: 'Gear',
				value: `Melee ${gear.melee.toFixed(1)}%, Ranged ${gear.range.toFixed(1)}%, Magic ${gear.mage.toFixed(1)}%`
			},
			{ name: 'Estimated death chances per room (group)', value: deaths.join('\n') },
			{
				name: 'Estimated rewards',
				value: `${TFA_BALANCING.uniquePercentPerPlayer}% purple chance per deathless player, one team roll, reduced by deaths. Three standard rolls each; one roll has 5x quantity if deathless (estimated, excludes fragments).`
			},
			{ name: 'Supplies per raid (charges extra)', value: tfaInput(user, kc, 1, 0).cost.toString() },
			{
				name: 'Death fee',
				value: `Up to ${TFA_BALANCING.deathFee.toLocaleString()} GP reserved per raid; unused GP is refunded. First ${TFA_BALANCING.learnerCompletions} completions: 75% discount.`
			},
			{
				name: 'Requirements',
				value: `${TFA_BALANCING.questPoints} QP, ${formatSkillRequirements(TFA_BALANCING.skills)}, ${TFA_BALANCING.minimumGearPercent}% gear in each style.`
			},
			{
				name: 'Boss routes',
				value: 'Choose each branching boss when starting, or let your minion pick a door at random. Solos scale to two players.'
			},
			{
				name: 'Fake mass',
				value: 'Use fake_mass to bring 1-7 copies of yourself. They share your gear and experience, but roll deaths and loot independently. You pay supplies once and receive only your own loot.'
			},
			{
				name: 'Auto-repeat',
				value: 'Use auto_repeat:true with solo:true or fake_mass to repeat automatically. /raid tfa stop finishes the current trip and stops the loop. Missing supplies or charges also stop it.'
			},
			{ name: 'Pending item definitions', value: TFAPendingRewards.map(i => i.name).join(', ') || 'None' }
		]);
	return { embeds: [embed] };
}

interface TFAStartOptions {
	solo?: boolean;
	fake_mass?: number;
	auto_repeat?: boolean;
	max_team_size?: number;
	quantity?: number;
	second_boss?: string;
	third_boss?: string;
	fourth_boss?: string;
}

export async function tfaStartCommand(interaction: OSInteraction, channelId: string, options: TFAStartOptions) {
	if (options.solo || options.fake_mass || options.max_team_size === 1) {
		return interaction.user.withLock('Start TFA trip', () =>
			startTFATrip(interaction.user, interaction.rng, channelId, options, interaction)
		);
	}
	return startTFATrip(interaction.user, interaction.rng, channelId, options, interaction);
}

async function startTFATrip(
	user: MUser,
	rng: RNGProvider,
	channelId: string,
	options: TFAStartOptions,
	interaction?: OSInteraction
) {
	const fakeMass = options.fake_mass ?? 0;
	if (options.fake_mass !== undefined && (!Number.isInteger(fakeMass) || fakeMass < 1 || fakeMass > 7)) {
		return 'Choose 1-7 copies for fake_mass, for a total team of 2-8 minions.';
	}
	if (fakeMass > 0 && options.solo)
		return 'Choose either solo or fake_mass. Your copies refuse to be imaginary twice.';
	const initialCheck = await checkTFAUser(user);
	if (initialCheck[0]) return initialCheck[1];
	const routeChoices: TFARouteChoices = {
		second: options.second_boss as TFARouteChoices['second'],
		third: options.third_boss as TFARouteChoices['third'],
		fourth: options.fourth_boss as TFARouteChoices['fourth']
	};
	if (
		(routeChoices.second && !['ezekiel', 'bork'].includes(routeChoices.second)) ||
		(routeChoices.third && !['moia', 'dreadnoth'].includes(routeChoices.third)) ||
		(routeChoices.fourth && !['xarth', 'dagonhai'].includes(routeChoices.fourth))
	)
		return 'Invalid TFA boss route.';
	const maxSize = fakeMass > 0 ? fakeMass + 1 : (options.max_team_size ?? 8);
	if (!Number.isInteger(maxSize) || maxSize < 1 || maxSize > 8) return 'TFA teams must have 1-8 players.';
	const personalTrip = fakeMass > 0 || options.solo || maxSize === 1;
	if (options.auto_repeat && !personalTrip)
		return 'Auto-repeat is only available for solo or fake-mass TFA trips. Choose solo:true, fake_mass, or max_team_size:1.';
	let users: MUser[];
	if (personalTrip) {
		users = [user];
	} else {
		if (!interaction) return 'A group raid needs a party interaction.';
		const partyOptions: MakePartyOptions = {
			interaction,
			leader: user,
			minSize: 1,
			maxSize,
			ironmanAllowed: true,
			message: `${user.usernameOrMention} is hosting a Fractured Archive raid. Nobody has read the instructions.\n${TFA_PROVISIONAL_MESSAGE}`,
			customDenier: joiningUser => checkTFAUser(joiningUser)
		};
		users = await globalClient.makeParty(partyOptions);
	}
	if (users.length < 1 || users.length > 8) return 'TFA teams must have 1-8 players.';
	if (await ActivityManager.anyMinionIsBusy(users)) return 'All team members must have their minions free.';
	const team = await Promise.all(
		users.map(async member => {
			const [kc, stats] = await Promise.all([
				member.fetchMinigameScore('fractured_archive'),
				member.fetchStats()
			]);
			return { id: member.id, kc, attempts: stats.tfa_attempts, gear: calculateUserGearPercents(member) };
		})
	);
	// Keep simulated IDs out of activity.users, supplies, stats and bank updates. Each copy is a
	// distinct simulation participant so deaths, wipe checks and purple allocation still use the full team.
	for (let i = 0; i < fakeMass; i++) {
		team.push({ ...team[0], id: `tfa-copy:${i + 1}` });
	}
	const tripLimits = await Promise.all(users.map(member => member.calcMaxTripLength('FracturedArchive')));
	const maxTripLength = Math.min(...tripLimits);
	const longestRoute = resolveTFARoute(
		{
			second: routeChoices.second ?? (TFABosses.ezekiel.minutes >= TFABosses.bork.minutes ? 'ezekiel' : 'bork'),
			third: routeChoices.third ?? (TFABosses.moia.minutes >= TFABosses.dreadnoth.minutes ? 'moia' : 'dreadnoth'),
			fourth:
				routeChoices.fourth ?? (TFABosses.xarth.minutes >= TFABosses.dagonhai.minutes ? 'xarth' : 'dagonhai')
		},
		rng
	);
	// Budget the longest possible route, including variation and deaths, before rolling any outcomes.
	const raidDuration =
		tfaRaidDuration(team, longestRoute) * (1 + TFA_BALANCING.durationVariation / 100) +
		longestRoute.length * TFA_BALANCING.deathPenalty;
	// Like ToB, a single learning raid may exceed the normal trip limit.
	const maximum = Math.min(TFA_BALANCING.maxQuantity, Math.max(1, Math.floor(maxTripLength / raidDuration)));
	const quantity = options.quantity ?? maximum;
	if (!Number.isInteger(quantity) || quantity < 1 || quantity > maximum) {
		return `You can attempt 1-${maximum} TFA raids with this team (${formatDuration(maxTripLength)} trip limit).`;
	}
	for (const member of users) {
		const check = await checkTFAUser(member, quantity);
		if (check[0]) return `Your raid failed to start: ${check[1]}`;
	}
	const raids = Array.from({ length: quantity }, () =>
		simulateTFARaid(team, resolveTFARoute(routeChoices, rng), rng)
	);
	const duration = raids.reduce((sum, raid) => sum + raid.duration, 0);
	const fakeDuration = raids.reduce((sum, raid) => sum + raid.fakeDuration, 0);
	const totalCost = new Bank();
	const costUsers = [];
	const costMessages = [];
	for (const [index, member] of users.entries()) {
		const { cost, charges } = tfaInput(member, team[index].kc, quantity, TFA_BALANCING.deathFee);
		const { realCost } = await member.specialRemoveItems(cost);
		const chargeMessage = await degradeChargeBank(member, charges);
		const suppliesCost = realCost.clone().remove('Coins', TFA_BALANCING.deathFee * quantity);
		await member.statsBankUpdate('tfa_cost', suppliesCost);
		totalCost.add(suppliesCost);
		costUsers.push({ id: member.id, cost: suppliesCost });
		costMessages.push(
			`${member.usernameOrMention} used ${suppliesCost}.${chargeMessage ? `\n${chargeMessage}` : ''}`
		);
	}
	await trackLoot({ id: 'fractured_archive', type: 'Minigame', changeType: 'cost', totalCost, users: costUsers });
	await ActivityManager.startTrip<FracturedArchiveTaskOptions>({
		type: 'FracturedArchive',
		userID: user.id,
		channelId,
		duration,
		leader: user.id,
		users: users.map(member => member.id),
		quantity,
		solo: team.length === 1,
		fakeMass: fakeMass || undefined,
		autoRepeat: Boolean(options.auto_repeat),
		maxTeamSize: maxSize,
		routeChoices,
		raids,
		fakeDuration,
		deathFeeReserved: TFA_BALANCING.deathFee
	});
	const routes = raids.map(
		(raid, index) => `Raid ${index + 1}: ${raid.route.map(boss => TFABosses[boss].name).join(' → ')}`
	);
	const party =
		fakeMass > 0
			? `${user.usernameOrMention} and ${fakeMass} simulated ${fakeMass === 1 ? 'copy' : 'copies'} of their minion`
			: users.map(member => member.usernameOrMention).join(', ');
	const fakeMassMessage =
		fakeMass > 0
			? '\nYour minion has cloned their confusion. Supplies and death fees apply only to you; each copy keeps its own imaginary loot.'
			: '';
	const summary = `${party} set off for ${quantity}x Fractured Archive. Expected return: ${formatTripDuration(user, fakeDuration)}.
${TFA_PROVISIONAL_MESSAGE}
${routes.join('\n')}${fakeMassMessage}
${(TFA_BALANCING.deathFee * quantity).toLocaleString()} GP per player is reserved for death fees; unused GP will be refunded.${options.auto_repeat ? '\nAuto-repeat is enabled. Your minion will keep getting lost until you use /raid tfa stop.' : ''}`;
	const supplies = costMessages.join('\n');
	if (summary.length + supplies.length + 1 > 1900) {
		return { content: summary, files: [{ name: 'tfa-supplies.txt', buffer: Buffer.from(supplies) }] };
	}
	return `${summary}\n${supplies}`;
}

export async function tfaStopCommand(user: MUser) {
	return user.withLock('Stop TFA auto-repeat', async () => {
		// Include completed activities: the trip may already be awarding loot when stop is requested.
		const activity = await prisma.activity.findFirst({
			where: { user_id: BigInt(user.id), type: 'FracturedArchive' },
			orderBy: { id: 'desc' }
		});
		if (!activity) return 'You do not have a TFA trip set to auto-repeat.';
		const data = ActivityManager.convertStoredActivityToFlatActivity(activity);
		if (data.type !== 'FracturedArchive' || !data.autoRepeat) return 'Your TFA auto-repeat is already stopped.';
		await prisma.activity.update({
			where: { id: activity.id },
			data: { data: { ...(activity.data as object), autoRepeat: false } }
		});
		return 'TFA auto-repeat stopped. Your current trip will finish normally and keep its loot. Your minion is relieved.';
	});
}

export async function autoRepeatTFATrip(data: FracturedArchiveTaskOptions, user: MUser, rng: RNGProvider) {
	if (!data.autoRepeat || data.users.length !== 1 || data.leader !== user.id) return;
	// Serialise stop and restart so a stop during completion cannot re-enable the loop.
	const response = await user.withLock('Repeat TFA trip', async () => {
		const activity = await prisma.activity.findUnique({ where: { id: data.id } });
		if (!activity) return null;
		const latest = ActivityManager.convertStoredActivityToFlatActivity(activity);
		if (latest.type !== 'FracturedArchive' || !latest.autoRepeat) return null;
		// Consume this repeat before starting another trip. Only the new activity owns the next repeat.
		await prisma.activity.update({
			where: { id: activity.id },
			data: { data: { ...(activity.data as object), autoRepeat: false } }
		});
		if (userIsBusy(user.id))
			return `${user.mention}, TFA auto-repeat stopped because you are running another command.`;
		try {
			const result = await startTFATrip(user, rng, data.channelId, {
				solo: !data.fakeMass,
				fake_mass: data.fakeMass,
				auto_repeat: true,
				max_team_size: data.maxTeamSize,
				quantity: data.quantity,
				second_boss: data.routeChoices.second,
				third_boss: data.routeChoices.third,
				fourth_boss: data.routeChoices.fourth
			});
			const next = await ActivityManager.getActivityOfUser(user.id);
			if (next?.type === 'FracturedArchive' && next.autoRepeat) return result;
			return `${user.mention}, TFA auto-repeat stopped: ${typeof result === 'string' ? result : 'The next trip could not be started.'}`;
		} catch (err) {
			Logging.logError(err as Error, { user_id: user.id, activity_id: data.id, type: 'TFA_AUTO_REPEAT' });
			return `${user.mention}, TFA auto-repeat stopped because the next trip could not be started. Your completed trip's loot has been kept.`;
		}
	});
	if (response) await globalClient.sendMessageOrWebhook(data.channelId, response);
}
