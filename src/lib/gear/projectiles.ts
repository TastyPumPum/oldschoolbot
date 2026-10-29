import { resolveItems } from 'oldschooljs';

export const projectiles = {
	arrow: {
		items: resolveItems(['Adamant arrow', 'Rune arrow', 'Amethyst arrow', 'Dragon arrow']),
		savedByAvas: true,
		weapons: resolveItems(['Twisted bow'])
	},
	ogreArrow: {
		items: resolveItems(['Ogre Arrow']),
		savedByAvas: true,
		weapons: resolveItems(['Ogre bow'])
	},
	bolt: {
		items: resolveItems([
			'Runite bolts',
			'Dragon bolts',
			'Diamond bolts (e)',
			'Diamond dragon bolts (e)',
			'Ruby dragon bolts (e)'
		]),
		savedByAvas: true,
		weapons: resolveItems([
			'Armadyl crossbow',
			'Dragon hunter crossbow',
			'Dragon crossbow',
			'Zaryte crossbow',
			'Rune crossbow'
		])
	},
	javelin: {
		items: resolveItems(['Amethyst javelin', 'Rune javelin', 'Dragon javelin']),
		savedByAvas: false,
		weapons: resolveItems(['Heavy ballista'])
	},
	ascensionBolt: {
		items: resolveItems([
			'Ascension bolts',
			'Diamond ascension bolts',
			'Diamond ascension bolts (e)',
			'Onyx ascension bolts',
			'Onyx ascension bolts (e)'
		]),
		savedByAvas: true,
		weapons: resolveItems(['Ascension crossbows'])
	}
} as const;
export type ProjectileType = keyof typeof projectiles;
