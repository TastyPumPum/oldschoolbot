import { minionActivityCache } from '../constants';

export function minionIsBusy(userID: string | string): boolean {
	if ((global as any).__mockMode) return false;

	const usersTask = getActivityOfUser(userID.toString());
	return Boolean(usersTask);
}

export function getActivityOfUser(userID: string) {
	const task = minionActivityCache.get(userID);
	return task ?? null;
}
