import { formatDuration, stringMatches, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import Prayer from '@/lib/skilling/skills/prayer.js';
import { TripError } from '@/lib/structures/TripError.js';
import type { BuryingActivityTaskOptions } from '@/lib/types/minions.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';

export async function buryCommand(user: MUser, channelId: string, boneName: string, quantity?: number) {
	const speedMod = 1;

	const bone = Prayer.Bones.find(
		bone => stringMatches(bone.name, boneName) || stringMatches(bone.name.split(' ')[0], boneName)
	);

	if (!bone) {
		throw new TripError("That's not a valid bone to bury.", [user.id]);
	}

	if (user.skillsAsLevels.prayer < bone.level) {
		throw new TripError(`${user.minionName} needs ${bone.level} Prayer to bury ${bone.name}.`, [user.id]);
	}

	const timeToBuryABone = speedMod * (Time.Second * 1.2 + Time.Second / 4);

	const maxTripLength = await user.calcMaxTripLength('Burying');

	if (!quantity) {
		const amountOfBonesOwned = user.bank.amount(bone.inputId);
		if (!amountOfBonesOwned) throw new TripError(`You have no ${bone.name}.`, [user.id]);
		quantity = Math.min(Math.floor(maxTripLength / timeToBuryABone), amountOfBonesOwned);
	}

	const cost = new Bank({ [bone.inputId]: quantity });

	if (!user.owns(cost)) {
		throw new TripError(`You dont have ${cost}.`, [user.id]);
	}

	const duration = quantity * timeToBuryABone;

	if (duration > maxTripLength) {
		throw new TripError(
			`${user.minionName} can't go on trips longer than ${formatDuration(
				maxTripLength
			)}, try a lower quantity. The highest amount of ${bone.name}s you can bury is ${Math.floor(
				maxTripLength / timeToBuryABone
			)}.`,
			[user.id]
		);
	}

	await user.transactItems({ itemsToRemove: cost });

	await ActivityManager.startTrip<BuryingActivityTaskOptions>({
		boneID: bone.inputId,
		userID: user.id,
		channelId,
		quantity,
		duration,
		type: 'Burying'
	});

	return `${user.minionName} is now burying ${cost}, it'll take around ${formatTripDuration(user, duration)} to finish.`;
}
