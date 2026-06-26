import { increaseNumByPercent } from '@oldschoolgg/toolkit';

import { canGainSailingXP } from '@/lib/skilling/skills/sailing/sailingXPUnlock.js';
import { type SkillNameType, SkillsArray } from '@/lib/skilling/types.js';
import type { ActivityTaskOptionsWithQuantity } from '@/lib/types/minions.js';

interface TearsOfGuthixSkillUser {
	user: {
		finished_quest_ids?: number[] | null;
	};
	skillsAsLevels: Record<SkillNameType, number>;
	skillsAsXP: Record<SkillNameType, number>;
}

export function getLowestTearsOfGuthixSkill(user: TearsOfGuthixSkillUser): SkillNameType {
	const eligibleSkills = SkillsArray.filter(skill => skill !== 'sailing' || canGainSailingXP(user));
	let lowestSkill = eligibleSkills[0]!;
	let lowestXp = user.skillsAsXP[lowestSkill];
	for (const skill of eligibleSkills) {
		const lvl = user.skillsAsLevels[skill];
		const xp = user.skillsAsXP[skill];
		if (lvl < user.skillsAsLevels[lowestSkill] || (lvl === user.skillsAsLevels[lowestSkill] && xp < lowestXp)) {
			lowestSkill = skill;
			lowestXp = xp;
		}
	}

	return lowestSkill;
}

export const togTask: MinionTask = {
	type: 'TearsOfGuthix',
	async run(data: ActivityTaskOptionsWithQuantity, { user, handleTripFinish, rng }) {
		const { channelId, duration } = data;

		await user.incrementMinigameScore('tears_of_guthix', 1);
		await user.statsUpdate({
			last_tears_of_guthix_timestamp: Date.now()
		});

		// Find lowest level skill
		const lowestSkill = getLowestTearsOfGuthixSkill(user);

		// Calculate number of tears collected
		// QP = Game length in ticks
		const qp = user.QP;
		// Streams last for 9 seconds, 15 game ticks
		const streams = Math.floor(qp / 15);
		let tears = 0;
		for (let stream = 0; stream < streams; stream++) {
			const percentCollected = rng.randInt(80, 100); // Collect 80 - 100% of each stream, depending on RNG of spawn and Runelite
			tears += Math.ceil(15 * (percentCollected / 100));
		}

		// Calculate tear value
		const baseXPperTear = 10;
		const xpPerTearScaling = 50 / 29;
		const xpScalingLevelCap = 30;
		const skillLevel = user.skillLevel(lowestSkill);
		const scaledXPperTear =
			skillLevel >= xpScalingLevelCap ? 60 : baseXPperTear + (skillLevel - 1) * xpPerTearScaling;

		let xpToGive = tears * scaledXPperTear;

		// 10% boost for Lumbridge&Draynor Hard
		const hasDiary = user.hasDiary('lumbridge&draynor.hard');
		if (hasDiary) xpToGive = increaseNumByPercent(xpToGive, 10);

		const xpStr = await user.addXP({ skillName: lowestSkill, amount: xpToGive, duration, source: 'TearsOfGuthix' });

		const message = `${user}, ${
			user.minionName
		} finished telling Juna a story and drinking from the Tears of Guthix and collected ${tears} tears.\nLowest XP skill is ${lowestSkill}.\n${xpStr.toLocaleString()}.${
			hasDiary ? '\n10% XP bonus for Lumbridge & Draynor Hard diary.' : ''
		}`;

		return handleTripFinish({ user, channelId, message, data });
	}
};
