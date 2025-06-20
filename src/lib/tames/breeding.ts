import { tame_growth, type Tame } from '@prisma/client';
import { Time, roll } from 'e';

import { prisma } from '../..';
import { tameSpecies } from '../tames';
import type { MUser } from '../MUser';

function isAdult(tame: Tame) {
       return tame.growth_stage === tame_growth.adult;
}

function nextBreedDate(tame: Tame) {
       return tame.breeding_cooldown_until?.getTime() ?? 0;
}

const hybridIDMap: Record<string, number> = {
       '1_2': 102,
       '1_3': 103,
       '2_3': 203
};

function getHybridID(id1: number, id2: number): number | undefined {
       const [a, b] = [id1, id2].sort((x, y) => x - y);
       return hybridIDMap[`${a}_${b}`];
}

export async function breedTames(user: MUser, parent1: Tame, parent2: Tame) {
  if (parent1.id === parent2.id) {
    return "You must select two different tames.";
  }
  if (parent1.user_id !== user.id || parent2.user_id !== user.id) {
    return "Both tames must belong to you.";
  }
  if (parent1.is_dead || parent2.is_dead) {
    return 'One of those tames is dead and cannot breed.';
  }
  const species1 = tameSpecies.find(s => s.id === parent1.species_id)!;
  const species2 = tameSpecies.find(s => s.id === parent2.species_id)!;
  if (species1.id === species2.id) {
    return 'Parents must be of different species.';
  }
  // Age checks
  const stages = [parent1.growth_stage, parent2.growth_stage];
  if (stages.includes(tame_growth.baby) && stages.includes(tame_growth.baby)) {
    return "Check this user's internet history.";
  }
  if (
    (stages.includes(tame_growth.baby) && stages.includes(tame_growth.adult))
  ) {
    return 'This user has been reported to Discord and local authorities.';
  }
  if (
    (stages.includes(tame_growth.juvenile) && stages.includes(tame_growth.adult))
  ) {
    return 'The teen tries to impress the adult, but the adult isn\'t interested.';
  }
  if (
    (stages.includes(tame_growth.juvenile) && stages.includes(tame_growth.baby))
  ) {
    return 'The teen babysits the baby tame. No one is in the mood for breeding.';
  }
  if (!isAdult(parent1) || !isAdult(parent2)) {
    return 'Both tames must be adults.';
  }
  const now = Date.now();
  if (now < nextBreedDate(parent1) || now < nextBreedDate(parent2)) {
    return 'One of these tames is still recovering from a previous breeding.';
  }

  // Offspring shiny logic
  const shiny1 = parent1.species_variant === species1.shinyVariant;
  const shiny2 = parent2.species_variant === species2.shinyVariant;
  let shiny = false;
  if (shiny1 && shiny2) {
    shiny = true;
  } else if (shiny1 || shiny2) {
    shiny = roll(Math.floor(species1.shinyChance / 2));
  } else {
    shiny = roll(species1.shinyChance);
  }

  const hybridName = `${species1.name.slice(0, 3)}-${species2.name.slice(-3)}`;

  const hybridID = getHybridID(species1.id, species2.id) ?? species1.id;

  const newTame = await prisma.tame.create({
    data: {
      user_id: user.id,
      species_id: hybridID,
      growth_stage: tame_growth.baby,
      growth_percent: 0,
      species_variant: shiny ? species1.shinyVariant : species1.variants[0],
      max_total_loot: {},
      fed_items: {},
      max_support_level: Math.floor((parent1.max_support_level + parent2.max_support_level) / 2),
      max_gatherer_level: Math.floor((parent1.max_gatherer_level + parent2.max_gatherer_level) / 2),
      max_artisan_level: Math.floor((parent1.max_artisan_level + parent2.max_artisan_level) / 2),
      max_combat_level: Math.floor((parent1.max_combat_level + parent2.max_combat_level) / 2),
      nickname: hybridName
    }
  });

  const deaths: string[] = [];

  const parent1Died = roll(4) !== 1;
  const parent2Died = roll(4) !== 1;

  await prisma.tame.update({
    where: { id: parent1.id },
    data: {
      breeding_cooldown_until: new Date(now + Time.Week),
      is_dead: parent1Died
    }
  });

  await prisma.tame.update({
    where: { id: parent2.id },
    data: {
      breeding_cooldown_until: new Date(now + Time.Week),
      is_dead: parent2Died
    }
  });

  if (parent1Died) {
    deaths.push(`${parent1.nickname ?? species1.name} has died from exhaustion.`);
  }
  if (parent2Died) {
    deaths.push(`${parent2.nickname ?? species2.name} has died from exhaustion.`);
  }

  let msg = `A new hybrid tame ${hybridName} was born${shiny ? ' and it\'s shiny!' : '!'}`;
  if (deaths.length > 0) {
    msg += `\n${deaths.join('\n')}`;
  }
  return msg;
}
