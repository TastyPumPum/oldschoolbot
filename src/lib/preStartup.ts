import type { ItemBank } from 'oldschooljs';

import { Prisma } from '@/prisma/main.js';
import { CUSTOM_PRICE_CACHE } from '@/lib/cache.js';
import { syncCollectionLogSlotTable } from '@/lib/collection-log/databaseCl.js';
import { badges, globalConfig } from '@/lib/constants.js';
import { GrandExchange } from '@/lib/grandExchange.js';
import { cacheGEPrices } from '@/lib/marketPrices.js';
import { SlayerTaskUnlocksEnum } from '@/lib/slayer/slayerUnlocks.js';
import { METAL_DRAGON_CANONICAL_ID, METAL_DRAGON_TASK_IDS } from '@/lib/slayer/tasks/metalDragonTask.js';

async function updateBadgeTable() {
	const badgesInDb = await prisma.badges.findMany();
	for (const [_id, emojiString] of Object.entries(badges)) {
		const id = Number(_id);
		if (!badgesInDb.find(b => b.id === id)) {
			await prisma.badges.create({
				data: {
					id,
					text: emojiString
				}
			});
		}
	}
}

export async function syncCustomPrices() {
	const clientData = await ClientSettings.fetch({ custom_prices: true });
	for (const [key, value] of Object.entries(clientData.custom_prices as ItemBank)) {
		CUSTOM_PRICE_CACHE.set(Number(key), Number(value));
	}
}

async function migrateMetalDragonSlayerTasks() {
	const refundedUnlocks = {
		[SlayerTaskUnlocksEnum.IHopeYouMithMe]: 80,
		[SlayerTaskUnlocksEnum.PedalToTheMetals]: 100,
		[SlayerTaskUnlocksEnum.IReallyMithYou]: 120,
		[SlayerTaskUnlocksEnum.AdamindSomeMore]: 100,
		[SlayerTaskUnlocksEnum.RUUUUUNE]: 100
	};
	const refundedUnlockIDs = Object.keys(refundedUnlocks).map(Number);
	const refundValues = Object.entries(refundedUnlocks).map(
		([unlockID, cost]) => Prisma.sql`(${Number(unlockID)}::int, ${cost}::int)`
	);
	const refundedUnlockIDsSQL = Prisma.sql`ARRAY[${Prisma.join(refundedUnlockIDs)}]::int[]`;
	const metalDragonIDsSQL = Prisma.sql`ARRAY[${Prisma.join([...METAL_DRAGON_TASK_IDS])}]::int[]`;

	await prisma.$executeRaw(Prisma.sql`
UPDATE users
SET
	"slayer.points" = "slayer.points" + (
		SELECT COALESCE(SUM(refunded.cost), 0)::int
		FROM unnest("slayer.unlocks") unlock_id
		JOIN (VALUES ${Prisma.join(refundValues)}) AS refunded(id, cost) ON refunded.id = unlock_id
	),
	"slayer.unlocks" = ARRAY(
		SELECT unlock_id
		FROM unnest("slayer.unlocks") unlock_id
		WHERE unlock_id <> ALL(${refundedUnlockIDsSQL})
	),
	"slayer.last_task" = CASE
		WHEN "slayer.last_task" = ANY(${metalDragonIDsSQL}) THEN ${METAL_DRAGON_CANONICAL_ID}::int
		ELSE "slayer.last_task"
	END,
	"slayer.blocked_ids" = CASE
		WHEN "slayer.blocked_ids" && ${metalDragonIDsSQL}
			THEN ARRAY(
				SELECT DISTINCT CASE
					WHEN blocked_id = ANY(${metalDragonIDsSQL}) THEN ${METAL_DRAGON_CANONICAL_ID}::int
					ELSE blocked_id
				END
				FROM unnest("slayer.blocked_ids") blocked_id
			)
		ELSE "slayer.blocked_ids"
	END
WHERE
	"slayer.unlocks" && ${refundedUnlockIDsSQL}
	OR "slayer.last_task" = ANY(${metalDragonIDsSQL})
	OR "slayer.blocked_ids" && ${metalDragonIDsSQL};
`);

	await prisma.slayerTask.updateMany({
		where: {
			monster_id: {
				in: [...METAL_DRAGON_TASK_IDS]
			},
			quantity_remaining: {
				gt: 0
			},
			skipped: false
		},
		data: {
			monster_id: METAL_DRAGON_CANONICAL_ID
		}
	});
}

export const preStartup = async () => {
	await prisma.clientStorage.upsert({
		where: { id: globalConfig.clientID },
		create: { id: globalConfig.clientID },
		update: {},
		select: { id: true }
	});

	await Promise.all([
		syncCustomPrices(),
		GrandExchange.init(),
		cacheGEPrices(),
		syncCollectionLogSlotTable(),
		updateBadgeTable(),
		migrateMetalDragonSlayerTasks()
	]);
};
