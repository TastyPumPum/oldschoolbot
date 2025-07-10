import { xp_gains_skill_enum } from '@prisma/client';
import { convertLVLtoXP } from 'oldschooljs';
import { Bank } from 'oldschooljs';
import { MAX_QP } from '../minions/data/quests';
import { GearBank } from '../structures/GearBank';

export function createMockUser(user: MUser): MUser {
	const maxLevels: Record<xp_gains_skill_enum, number> = {} as any;
	const maxXP: Record<xp_gains_skill_enum, number> = {} as any;
	for (const skill of Object.values(xp_gains_skill_enum)) {
		maxLevels[skill] = 99;
		maxXP[skill] = convertLVLtoXP(99);
	}
	const fake = Object.create(user);
	fake.skillLevel = () => 99;
	fake.skillsAsLevels = maxLevels as any;
	fake.skillsAsXP = maxXP as any;
	fake.owns = () => true;
	fake.hasEquippedOrInBank = () => true;
	fake.hasEquipped = () => true;
	fake.hasSkillReqs = () => true;
	fake.hasCompletedQuest = () => true;
	fake.GP = 1_000_000_000;
	fake.QP = MAX_QP;
	fake.minionIsBusy = false;
	fake.isMock = true;
	fake.perkTier = () => 6;
	fake.update = async () => ({ newUser: user.user });
	fake.addItemsToBank = async () => undefined;
	fake.removeItemsFromBank = async () => undefined;
	fake.addXP = () => '';
	Object.defineProperty(fake, 'gearBank', {
		get() {
			return new GearBank({
				gear: user.gear,
				bank: new Bank(),
				skillsAsLevels: maxLevels as any,
				chargeBank: user.ownedChargeBank(),
				skillsAsXP: maxXP as any
			});
		}
	});
	return fake;
}
