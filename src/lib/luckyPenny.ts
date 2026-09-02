type LuckyPennyUser = {
	bitfield: readonly number[];
	hasCompletedCATier: (tier: 'master') => boolean;
	hasEquippedOrInBank: (item: "Ghommal's lucky penny") => boolean;
};

export function hasActiveLuckyPennyEffect(user: LuckyPennyUser): boolean {
	const hasUnlockedPennyEffect = user.bitfield.includes(59) || user.hasEquippedOrInBank("Ghommal's lucky penny");
	return hasUnlockedPennyEffect && user.hasCompletedCATier('master');
}
