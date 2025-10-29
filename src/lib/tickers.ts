import {
	awaitMessageComponentInteraction,
	getNextUTCReset,
	noOp,
	removeFromArr,
	stringMatches,
	Time
} from '@oldschoolgg/toolkit';
import { TimerManager } from '@sapphire/timer-manager';
import type { TextChannel } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { Bank } from 'oldschooljs';

import { analyticsTick } from '@/lib/analytics.js';
import { syncBlacklists } from '@/lib/blacklists.js';
import { BitField, Channel, globalConfig } from '@/lib/constants.js';
import { GrandExchange } from '@/lib/grandExchange.js';
import { mahojiUserSettingsUpdate } from '@/lib/MUser.js';
import { cacheGEPrices } from '@/lib/marketPrices.js';
import { collectMetrics } from '@/lib/metrics.js';
import { BERT_SAND_BUCKETS, bertResetStart, isManualEligible } from '@/lib/minions/data/bertSand.js';
import { populateRoboChimpCache } from '@/lib/perkTier.js';
import { runCommand } from '@/lib/settings/settings.js';
import { informationalButtons } from '@/lib/sharedComponents.js';
import { Farming } from '@/lib/skilling/skills/farming/index.js';
import { MInteraction } from '@/lib/structures/MInteraction.js';
import { handleGiveawayCompletion } from '@/lib/util/giveaway.js';
import { getSupportGuild } from '@/lib/util.js';

let lastMessageID: string | null = null;
let lastMessageGEID: string | null = null;
const BERT_SAND_BATCH_SIZE = 100;
const BERT_SAND_ACTIVE_WINDOW = Time.Day * 7;
let bertSandQueue: string[] = [];
let bertSandLastReset = 0;
let bertSandQueuePrepared = false;
const supportEmbed = new EmbedBuilder()
	.setAuthor({ name: '⚠️ ⚠️ ⚠️ ⚠️ READ THIS ⚠️ ⚠️ ⚠️ ⚠️' })
	.addFields({
		name: '📖 Read the FAQ',
		value: 'The FAQ answers commonly asked questions: https://wiki.oldschool.gg/getting-started/faq/ - also make sure to read the other pages of the website, which might contain the information you need.'
	})
	.addFields({
		name: '🔎 Search',
		value: 'Search this channel first, you might find your question has already been asked and answered.'
	})
	.addFields({
		name: '💬 Ask',
		value: "If your question isn't answered in the FAQ, and you can't find it from searching, simply ask your question and wait for someone to answer. If you don't get an answer, you can post your question again."
	})
	.addFields({
		name: '⚠️ Dont ping anyone',
		value: 'Do not ping mods, or any roles/people in here. You will be muted. Ask your question, and wait.'
	});

const geEmbed = new EmbedBuilder()
	.setAuthor({ name: '⚠️ ⚠️ ⚠️ ⚠️ READ THIS ⚠️ ⚠️ ⚠️ ⚠️' })
	.addFields({
		name: "⚠️ Don't get scammed",
		value: 'Beware of people "buying out banks" or buying lots of skilling supplies, which can be worth a lot more in the bot than they pay you. Skilling supplies are often worth a lot more than they are ingame. Don\'t just trust that they\'re giving you a fair price.'
	})
	.addFields({
		name: '🔎 Search',
		value: 'Search this channel first, someone might already be selling/buying what you want.'
	})
	.addFields({
		name: '💬 Read the rules/Pins',
		value: 'Read the pinned rules/instructions before using the channel.'
	})
	.addFields({
		name: 'Keep Ads Short',
		value: 'Keep your ad less than 10 lines long, as short as possible.'
	});

/**
 * Tickers should idempotent, and be able to run at any time.
 */
export const tickers: {
	name: string;
	startupWait?: number;
	interval: number;
	timer: NodeJS.Timeout | null;
	productionOnly?: true;
	cb: () => Promise<unknown>;
}[] = [
	{
		name: 'giveaways',
		startupWait: Time.Second * 30,
		interval: Time.Second * 10,
		timer: null,
		cb: async () => {
			const result = await prisma.giveaway.findMany({
				where: {
					completed: false,
					finish_date: {
						lt: new Date()
					}
				}
			});

			await Promise.all(result.map(t => handleGiveawayCompletion(t)));
		}
	},
	{
		name: 'metrics',
		timer: null,
		interval: Time.Minute,
		cb: async () => {
			const data = {
				timestamp: Math.floor(Date.now() / 1000),
				...(await collectMetrics())
			};
			if (Number.isNaN(data.eventLoopDelayMean)) {
				data.eventLoopDelayMean = 0;
			}
			await prisma.metric.create({
				data
			});
		}
	},
	{
		name: 'minion_activities',
		startupWait: Time.Second * 10,
		timer: null,
		interval: globalConfig.isProduction ? Time.Second * 5 : 500,
		cb: async () => {
			await ActivityManager.processPendingActivities();
		}
	},
	{
		name: 'farming_reminder_ticker',
		startupWait: Time.Minute,
		interval: Time.Minute * 3.5,
		timer: null,
		productionOnly: true,
		cb: async () => {
			const basePlantTime = 1_626_556_507_451;
			const now = Date.now();
			const users = await prisma.user.findMany({
				where: {
					bitfield: {
						hasSome: [
							BitField.IsPatronTier3,
							BitField.IsPatronTier4,
							BitField.IsPatronTier5,
							BitField.IsPatronTier6,
							BitField.isModerator
						]
					}
				}
			});
			for (const partialUser of users) {
				if (partialUser.bitfield.includes(BitField.DisabledFarmingReminders)) continue;
				const user = await mUserFetch(partialUser.id);
				const { patches } = await Farming.getFarmingInfoFromUser(user);
				for (const patchType of Farming.farmingPatchNames) {
					const patch = patches[patchType];
					if (!patch) continue;
					if (patch.plantTime < basePlantTime) continue;

					const storeHarvestablePlant = patch.lastPlanted;
					const planted = storeHarvestablePlant
						? (Farming.Plants.find(plants => stringMatches(plants.name, storeHarvestablePlant)) ??
							Farming.Plants.find(
								plants =>
									stringMatches(plants.name, storeHarvestablePlant) ||
									stringMatches(plants.name.split(' ')[0], storeHarvestablePlant)
							))
						: null;
					const difference = now - patch.plantTime;
					if (!planted) continue;
					if (difference < planted.growthTime * Time.Minute) continue;
					if (patch.wasReminded) continue;
					await user.update({
						[Farming.getFarmingKeyFromName(patchType)]: { ...patch, wasReminded: true }
					});

					// Build buttons (only show Harvest/replant if not busy):
					const farmingReminderButtons = new ActionRowBuilder<ButtonBuilder>();
					if (!ActivityManager.minionIsBusy(user.id)) {
						farmingReminderButtons.addComponents(
							new ButtonBuilder()
								.setLabel('Harvest & Replant')
								.setStyle(ButtonStyle.Primary)
								.setCustomId('HARVEST')
						);
					}
					// Always show disable reminders:
					farmingReminderButtons.addComponents(
						new ButtonBuilder()
							.setLabel('Disable Reminders')
							.setStyle(ButtonStyle.Secondary)
							.setCustomId('DISABLE')
					);
					const djsUser = await globalClient.users.cache.get(user.id);
					if (!djsUser) continue;
					const message = await djsUser
						.send({
							content: `The ${planted.name} planted in your ${patchType} patches are ready to be harvested!`,
							components: [farmingReminderButtons]
						})
						.catch(noOp);
					if (!message) return;
					try {
						const selection = await awaitMessageComponentInteraction({
							message,
							time: Time.Minute * 5,
							filter: () => true
						});
						if (!selection.isButton()) return;
						message.edit({ components: [] });

						// Check disable first so minion doesn't have to be free to disable reminders.
						if (selection.customId === 'DISABLE') {
							await mahojiUserSettingsUpdate(user.id, {
								bitfield: removeFromArr(user.bitfield, BitField.DisabledFarmingReminders)
							});
							await djsUser.send('Farming patch reminders have been disabled.');
							return;
						}
						if (ActivityManager.minionIsBusy(user.id)) {
							selection.reply({ content: 'Your minion is busy.' });
							return;
						}
						if (selection.customId === 'HARVEST') {
							message.author = djsUser;
							runCommand({
								commandName: 'farming',
								args: { harvest: { patch_name: patchType } },
								user: await mUserFetch(user.id),
								interaction: new MInteraction({ interaction: selection }),
								continueDeltaMillis: selection.createdAt.getTime() - message.createdAt.getTime()
							});
						}
					} catch {
						message.edit({ components: [] });
					}
				}
			}
		}
	},
	{
		name: 'support_channel_messages',
		timer: null,
		startupWait: Time.Second * 22,
		interval: Time.Minute * 20,
		productionOnly: true,
		cb: async () => {
			const guild = getSupportGuild();
			const channel = guild?.channels.cache.get(Channel.HelpAndSupport) as TextChannel | undefined;
			if (!channel) return;
			const messages = await channel.messages.fetch({ limit: 5 });
			if (messages.some(m => m.author.id === globalClient.user?.id)) return;
			if (lastMessageID) {
				const message = await channel.messages.fetch(lastMessageID).catch(noOp);
				if (message) {
					await message.delete();
				}
			}
			const res = await channel.send({
				embeds: [supportEmbed],
				components: [new ActionRowBuilder<ButtonBuilder>().addComponents(informationalButtons)]
			});
			lastMessageID = res.id;
		}
	},
	{
		name: 'ge_channel_messages',
		startupWait: Time.Second * 19,
		timer: null,
		interval: Time.Minute * 20,
		productionOnly: true,
		cb: async () => {
			const guild = getSupportGuild();
			const channel = guild?.channels.cache.get(Channel.GrandExchange) as TextChannel | undefined;
			if (!channel) return;
			const messages = await channel.messages.fetch({ limit: 5 });
			if (messages.some(m => m.author.id === globalClient.user?.id)) return;
			if (lastMessageGEID) {
				const message = await channel.messages.fetch(lastMessageGEID).catch(noOp);
				if (message) {
					await message.delete();
				}
			}
			const res = await channel.send({ embeds: [geEmbed] });
			lastMessageGEID = res.id;
		}
	},
	{
		name: 'ge_ticker',
		startupWait: Time.Second * 30,
		timer: null,
		interval: Time.Second * 10,
		cb: async () => {
			await GrandExchange.tick();
		}
	},
	{
		name: 'robochimp_cache',
		startupWait: Time.Minute * 5,
		timer: null,
		interval: Time.Minute * 5,
		cb: async () => {
			await populateRoboChimpCache();
		}
	},
	{
		name: 'Sync Blacklists',
		timer: null,
		interval: Time.Minute * 10,
		cb: async () => {
			await syncBlacklists();
		}
	},
	{
		name: 'Analytics',
		timer: null,
		interval: Time.Hour * 4.44,
		startupWait: Time.Minute * 30,
		cb: async () => {
			await analyticsTick();
		}
	},
	{
		name: 'Presence Update',
		timer: null,
		interval: Time.Hour * 8.44,
		cb: async () => {
			globalClient.user?.setActivity('/help');
		}
	},
	{
		name: 'Economy Item Snapshot',
		timer: null,
		startupWait: Time.Minute * 20,
		interval: Time.Hour * 13.55,
		cb: async () => {
			await prisma.$executeRaw`INSERT INTO economy_item_banks (bank)
VALUES (get_economy_bank());`;
		}
	},
	{
		name: "Bert's sand delivery",
		timer: null,
		startupWait: Time.Minute * 5,
		interval: Time.Minute * 5,
		cb: async () => {
			const now = Date.now();
			const currentResetStart = bertResetStart(now);

			if (bertSandLastReset < currentResetStart) {
				bertSandQueue = [];
				bertSandQueuePrepared = false;
				bertSandLastReset = currentResetStart;
			}

			if (!bertSandQueuePrepared) {
				const activeSince = new Date(now - BERT_SAND_ACTIVE_WINDOW);
				const users = await prisma.user.findMany({
					where: {
						completed_achievement_diaries: {
							has: 'ardougne.elite'
						},
						last_command_date: {
							gte: activeSince
						}
					},
					select: {
						id: true
					}
				});

				bertSandQueue = users.map(u => u.id);
				bertSandQueuePrepared = true;
			}

			if (bertSandQueue.length === 0) {
				return;
			}

			const loot = new Bank({ 'Bucket of sand': BERT_SAND_BUCKETS });
			const batch = bertSandQueue.splice(0, BERT_SAND_BATCH_SIZE);
			const resetStart = bertResetStart(now);

			for (const id of batch) {
				const user = await mUserFetch(id);
				const requirementError = isManualEligible(user);
				if (requirementError) {
					continue;
				}

				const updated = await prisma.userStats.updateMany({
					where: {
						user_id: BigInt(user.id),
						last_bert_sand_timestamp: { lt: BigInt(resetStart) }
					},
					data: { last_bert_sand_timestamp: BigInt(now) }
				});

				if (updated.count === 0) {
					continue;
				}

				// Ardougne elite diary unlocks this auto-collection perk; when it procs we still
				// enforce the manual requirements so the reward mirrors the slash command.
				await user.addItemsToBank({ items: loot, collectionLog: false });
			}
		}
	},
	{
		name: 'Cache G.E Prices',
		timer: null,
		interval: Time.Hour * 12.55,
		startupWait: Time.Minute * 25,
		cb: async () => {
			await cacheGEPrices();
		}
	}
];

export function initTickers() {
	for (const ticker of tickers) {
		if (ticker.timer !== null) clearTimeout(ticker.timer);
		if (ticker.productionOnly && !globalConfig.isProduction) continue;
		const fn = async () => {
			try {
				if (globalClient.isShuttingDown) return;
				const start = performance.now();
				await ticker.cb();
				const end = performance.now();
				Logging.logPerf({
					duration: end - start,
					text: `Ticker.${ticker.name}`
				});
			} catch (err) {
				Logging.logError(err as Error);
			} finally {
				if (ticker.timer) TimerManager.clearTimeout(ticker.timer);
				ticker.timer = TimerManager.setTimeout(fn, ticker.interval);
			}
		};
		ticker.timer = TimerManager.setTimeout(() => {
			fn();
		}, ticker.startupWait ?? 1);
	}
}
