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
	fake.skillsAsLevels = maxLevels;
	fake.skillsAsXP = maxXP;
	fake.owns = () => true;
	fake.hasEquippedOrInBank = () => true;
	fake.hasEquipped = () => true;
	fake.hasSkillReqs = () => true;
	fake.hasCompletedQuest = () => true;
	fake.perkTier = () => 6;
	fake.update = async () => ({ newUser: user.user });
	fake.addItemsToBank = async () => undefined;
	fake.removeItemsFromBank = async () => undefined;
	fake.addXP = () => '';
	fake.isMock = true;

	Object.defineProperties(fake, {
		GP: { get: () => 1_000_000_000 },
		QP: { get: () => MAX_QP },
		minionIsBusy: { get: () => false },
		gearBank: {
			get() {
				return new GearBank({
					gear: user.gear,
					bank: new Bank(),
					skillsAsLevels: maxLevels,
					chargeBank: user.ownedChargeBank(),
					skillsAsXP: maxXP
				});
			}
		}
	});

	return fake;
}
