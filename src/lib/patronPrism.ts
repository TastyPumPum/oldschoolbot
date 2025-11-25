import { Bank, itemID } from 'oldschooljs';

const PATRON_PRISM_ID = itemID('Patron Prism paint can');

function hasDistributedThisMonth(lastRun: Date | null, now: Date) {
	if (!lastRun) return false;
	return lastRun.getUTCFullYear() === now.getUTCFullYear() && lastRun.getUTCMonth() === now.getUTCMonth();
}

export async function distributePatronPrismPaints() {
	const now = new Date();
	if (now.getUTCDate() !== 1) return;

	const clientSettings = await ClientSettings.fetch({ patron_prism_last_distributed: true });
	const lastRunDate = clientSettings.patron_prism_last_distributed
		? new Date(clientSettings.patron_prism_last_distributed)
		: null;

	if (hasDistributedThisMonth(lastRunDate, now)) return;

	const patrons = await roboChimpClient.user.findMany({
		where: {
			premium_balance_tier: { not: null },
			premium_balance_expiry_date: { gt: BigInt(Date.now()) }
		},
		select: {
			id: true,
			premium_balance_tier: true
		}
	});

	let totalGiven = 0;
	let recipients = 0;
	for (const patron of patrons) {
		const tier = patron.premium_balance_tier ?? 0;
		if (tier <= 0) continue;
		const user = await mUserFetch(patron.id.toString());
		const itemsToAdd = new Bank().add(PATRON_PRISM_ID, tier);
		await user.transactItems({ itemsToAdd, collectionLog: true, filterLoot: false });
		totalGiven += tier;
		recipients++;
	}

	await ClientSettings.update({ patron_prism_last_distributed: new Date() });

	if (recipients > 0) {
		Logging.logDebug(`Distributed ${totalGiven} Patron Prism paint cans to ${recipients} patrons.`);
	}
}
