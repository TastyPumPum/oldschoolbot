import { Bank } from 'oldschooljs';

import { SkillsEnum } from '@/lib/skilling/types';
import type { BarbloreActivityTaskOptions } from '@/lib/types/minions';

export const barbloreTask: MinionTask = {
type: 'BarbloreFishing' as any,
isNew: true,
async run(data: BarbloreActivityTaskOptions, { user, handleTripFinish }) {
const { channelID } = data;

const loot = new Bank();

for (const plan of data.mixPlan) {
if (plan.quantity > 0) {
loot.add(plan.mixID, plan.quantity);
}
}

if (data.leftoverFish.trout > 0) {
loot.add('Leaping trout', data.leftoverFish.trout);
}
if (data.leftoverFish.salmon > 0) {
loot.add('Leaping salmon', data.leftoverFish.salmon);
}
if (data.leftoverFish.sturgeon > 0) {
loot.add('Leaping sturgeon', data.leftoverFish.sturgeon);
}

if (data.leftoverIngredients.roe > 0) {
loot.add('Roe', data.leftoverIngredients.roe);
}
if (data.leftoverIngredients.caviar > 0) {
loot.add('Caviar', data.leftoverIngredients.caviar);
}

if (data.fishOffcuts > 0) {
loot.add('Fish offcuts', data.fishOffcuts);
}

const xpMessages: string[] = [];

if (data.xp.fishing > 0) {
const message = await user.addXP({
skillName: SkillsEnum.Fishing,
amount: data.xp.fishing,
duration: data.duration
});
if (message) xpMessages.push(message);
}
if (data.xp.agility > 0) {
const message = await user.addXP({
skillName: SkillsEnum.Agility,
amount: data.xp.agility,
duration: data.duration
});
if (message) xpMessages.push(message);
}
if (data.xp.strength > 0) {
const message = await user.addXP({
skillName: SkillsEnum.Strength,
amount: data.xp.strength,
duration: data.duration
});
if (message) xpMessages.push(message);
}
if (data.xp.cooking > 0) {
const message = await user.addXP({
skillName: SkillsEnum.Cooking,
amount: data.xp.cooking,
duration: data.duration
});
if (message) xpMessages.push(message);
}
if (data.xp.herblore > 0) {
const message = await user.addXP({
skillName: SkillsEnum.Herblore,
amount: data.xp.herblore,
duration: data.duration
});
if (message) xpMessages.push(message);
}

await transactItems({
userID: user.id,
itemsToAdd: loot,
collectionLog: true
});

const mixSummary =
data.mixPlan.length > 0
? data.mixPlan
.filter(plan => plan.quantity > 0)
.map(plan => `${plan.quantity.toLocaleString()}x ${plan.mixName}`)
.join(', ')
: null;

let str = `${user}, ${user.minionName} finished a Barblore fishing trip covering ${data.quantity.toLocaleString()} actions.`;

if (mixSummary) {
str += ` They created ${mixSummary}.`;
}

if (xpMessages.length > 0) {
str += `\n${xpMessages.join('\n')}`;
}

if (loot.length > 0) {
str += `\n\nYou received: ${loot}.`;
}

if (data.boosts.length > 0) {
str += `\n\n**Boosts:** ${data.boosts.join(', ')}`;
}

handleTripFinish(user, channelID, str, undefined, data, loot);
}
};
