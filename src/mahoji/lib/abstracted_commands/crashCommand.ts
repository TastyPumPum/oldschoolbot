import { formatDuration } from '@oldschoolgg/toolkit';
import { Bank, toKMB } from 'oldschooljs';

import {
	type CrashRisk,
	formatCrashMultiplier,
	MAX_CRASH_MULTIPLIER,
	MIN_CRASH_MULTIPLIER,
	parseCrashAutoMultiplier,
	rollCrashPoint
} from '@/lib/util/crashGame.js';
import { mahojiParseNumber } from '@/mahoji/mahojiSettings.js';

const MIN_CRASH_BET = 10_000;
const MAX_CRASH_BET = 500_000_000;

export async function crashCommand(
	rng: RNGProvider,
	user: MUser,
	autoInput: string | undefined,
	amountInput: string | undefined,
	risk: CrashRisk | undefined
) {
	if (!amountInput || !autoInput) {
		return `Play crash with auto cashout using ${globalClient.mentionCommand('gamble', 'crash')}.
Example: ${globalClient.mentionCommand('gamble', 'crash')} amount:1m auto:2x`;
	}

	if (user.isIronman) return "Ironmen can't gamble!";

	const ratelimit = await Cache.tryRatelimit(user.id, 'gamble_crash');
	if (!ratelimit.success) {
		return `This command is on cooldown, you can use it again in ${formatDuration(ratelimit.timeRemainingMs)}.`;
	}

	const amount = mahojiParseNumber({ input: amountInput, min: 1, max: 500_000_000_000 });
	if (!amount || !Number.isInteger(amount) || amount < MIN_CRASH_BET || amount > MAX_CRASH_BET) {
		return `You can only gamble between ${toKMB(MIN_CRASH_BET)} and ${toKMB(MAX_CRASH_BET)}.`;
	}

	const autoMultiplier = parseCrashAutoMultiplier(autoInput);
	if (!autoMultiplier || autoMultiplier < MIN_CRASH_MULTIPLIER) {
		return 'Auto cashout must be at least 1.01x.';
	}
	if (autoMultiplier > MAX_CRASH_MULTIPLIER) {
		return `Auto cashout cannot exceed ${formatCrashMultiplier(MAX_CRASH_MULTIPLIER)}.`;
	}

	if (user.GP < amount) return "You can't afford to gamble that much.";

	const selectedRisk = risk ?? 'med';
	const crashPoint = rollCrashPoint(rng, selectedRisk);
	const won = crashPoint >= autoMultiplier;
	const profit = won ? Math.floor((amount * (autoMultiplier - 100)) / 100) : -amount;
	const payout = amount + profit;

	await ClientSettings.updateClientGPTrackSetting('gp_crash', profit);
	await user.updateGPTrackSetting('gp_crash', profit);

	if (won) {
		const currentBiggestWin = Number(await user.fetchUserStat('gp_crash_biggest_win')) || 0;
		await user.statsUpdate({
			crash_wins: { increment: 1 },
			gp_crash_wagered: { increment: amount },
			gp_crash_biggest_win: { set: Math.max(currentBiggestWin, profit) }
		});
		await user.addItemsToBank({ items: new Bank().add('Coins', payout) });
	} else {
		await user.statsUpdate({
			crash_losses: { increment: 1 },
			gp_crash_wagered: { increment: amount }
		});
		await user.removeItemsFromBank(new Bank().add('Coins', amount));
	}

	return `Crash: ${formatCrashMultiplier(crashPoint)}
${won ? `✅ Cashed at ${formatCrashMultiplier(autoMultiplier)}` : `💥 Crashed before ${formatCrashMultiplier(autoMultiplier)}`}
${won ? `Profit: +${toKMB(profit)} GP` : `Loss: -${toKMB(amount)} GP`}`;
}
