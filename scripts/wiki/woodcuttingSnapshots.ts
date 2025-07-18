import { Table } from '@oldschoolgg/toolkit';
import { Items, itemID } from 'oldschooljs';

import '../../src/lib/safeglobals.js';

import Woodcutting from '@/lib/skilling/skills/woodcutting/woodcutting.js';
import type { Log } from '@/lib/skilling/types.js';
import { handleMarkdownEmbed } from './wikiScriptUtil.js';

function getAxeMultiplier(level: number) {
	if (level >= 71) return 4;
	if (level >= 61) return 3.75;
	if (level >= 41) return 3.5;
	if (level >= 31) return 3;
	if (level >= 21) return 2.5;
	if (level >= 11) return 2.25;
	if (level >= 6) return 2;
	if (level >= 1) return 1.5;
	return 1;
}

function calcLogsPerHour(log: Log, level: number): number {
	const axeMult = getAxeMultiplier(level);
	let chanceOfSuccess = (log.slope * level + log.intercept) * axeMult;
	if (chanceOfSuccess > 100) chanceOfSuccess = 100;
	const teakTick = level >= 92 && (log.id === itemID('Teak logs') ? true : log.id === itemID('Mahogany logs'));
	const attemptTime = teakTick ? 1.5 : 4;
	const expectedAttempts = 100 / chanceOfSuccess;
	let ticks = expectedAttempts * attemptTime;
	const postTime = (log.depletionChance / 100) * log.findNewTreeTime + (1 - log.depletionChance / 100) * attemptTime;
	ticks += postTime;
	ticks += log.bankingTime / 28;
	const secondsPerLog = ticks * 0.6;
	return 3600 / secondsPerLog;
}

function main() {
	const levels = [1, 10, 40, 70, 80, 90, 99];
	const results: { log: Log; level: number; xpHr: number; logsHr: number }[] = [];
	for (const level of levels) {
		for (const log of Woodcutting.Logs) {
			if (log.level > level) continue;
			const logsHr = calcLogsPerHour(log, level);
			const xpHr = Math.floor((logsHr * log.xp) / 1000) * 1000;
			results.push({ log, level, xpHr, logsHr });
		}
	}

	results.sort((a, b) => a.log.name.localeCompare(b.log.name));
	results.sort((a, b) => b.xpHr - a.xpHr);

	const table = new Table();
	table.addHeader('Log', 'Woodcutting Lvl', 'XP/hr', 'Logs/hr');
	for (const r of results) {
		table.addRow(
			`[[${Items.itemNameFromId(r.log.id)}]]`,
			r.level.toString(),
			r.xpHr.toLocaleString(),
			Math.round(r.logsHr).toLocaleString()
		);
	}

	handleMarkdownEmbed('woodcuttingxphr', 'osb/Skills/woodcutting/README.md', table.toString());
}

main();
