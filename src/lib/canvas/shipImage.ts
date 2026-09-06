import { Canvas, loadImage } from 'skia-canvas';

import type { SailingShipType } from '@/lib/skilling/skills/sailing/shipParts.js';

const SAILING_IMG_DIR = './src/lib/resources/images/sailing';

const shipImageFile: Record<SailingShipType, string> = {
	raft: 'Raft.png',
	skiff: 'Skiff.png',
	sloop: 'Sloop.png'
};

export async function makeShipImage(shipType: SailingShipType) {
	const [background, ship] = await Promise.all([
		loadImage(`${SAILING_IMG_DIR}/SailingBG1.png`),
		loadImage(`${SAILING_IMG_DIR}/${shipImageFile[shipType]}`)
	]);
	const canvas = new Canvas(background.width, background.height);
	canvas.gpu = false;
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(background, 0, 0, background.width, background.height);

	const maxShipWidth = 620;
	const maxShipHeight = 325;
	const scale = Math.min(1, maxShipWidth / ship.width, maxShipHeight / ship.height);
	const width = Math.floor(ship.width * scale);
	const height = Math.floor(ship.height * scale);
	const x = Math.floor(845 - width / 2);
	const y = Math.floor(360 - height);
	ctx.drawImage(ship, x, y, width, height);

	return canvas.png;
}
