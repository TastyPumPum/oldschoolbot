import type { SailingActivity } from '@/lib/skilling/skills/sailing/activities.js';

export function calcSailingTripStart({
	activity,
	maxTripLength,
	quantityInput,
	timeMultiplier = 1
}: {
	activity: SailingActivity;
	maxTripLength: number;
	quantityInput?: number;
	timeMultiplier?: number;
}) {
	const durationPerAction = Math.max(1000, Math.floor(activity.baseTime * timeMultiplier));

	const maxQuantity = Math.max(1, Math.floor(maxTripLength / durationPerAction));
	const quantity = quantityInput ? Math.min(quantityInput, maxQuantity) : maxQuantity;
	const duration = quantity * durationPerAction;

	return { quantity, duration };
}
