import { type Item, LootTable } from 'oldschooljs';
import type { Canvas } from 'skia-canvas';

import { type CanvasImage, createCanvas } from '@/lib/canvas/canvasUtil.js';
import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { paintColors } from '../customItems/paintCans.js';

export type PaintStyle = {
	type: 'patron-prism';
	coreColor: [number, number, number];
	ringStops: Array<{
		color: [number, number, number, number?];
		at: number;
	}>;
};

export interface PaintColor {
	name: string;
	rgb: [number, number, number];
	itemId: number;
	paintCanItem: Item;
	style?: PaintStyle;
}

export const paintColorsMap = new Map(paintColors.map(i => [i.itemId, i]));

export const applyPaintToItemIcon = async (
	img: CanvasImage | Canvas,
	tintColor: [number, number, number],
	blackTolerance = 4
) => {
	const canvas = createCanvas(img.width, img.height);
	const ctx = canvas.getContext('2d');
	const [r, g, b] = tintColor;
	ctx.drawImage(img, 0, 0, img.width, img.height);
	const imageData = ctx.getImageData(0, 0, img.width, img.height);

	for (let i = 0; i < imageData.data.length; i += 4) {
		const originalRed = imageData.data[i + 0] as number;
		const originalGreen = imageData.data[i + 1] as number;
		const originalBlue = imageData.data[i + 2] as number;

		if (
			(originalRed === 48 && originalGreen === 32 && originalBlue === 32) ||
			(originalRed <= blackTolerance && originalGreen <= blackTolerance && originalBlue <= blackTolerance)
		) {
			// Skip pixels that are black (with tolerance) or exactly r=48, g=32, b=32
			continue;
		}

		// Special case for inversion paint:
		if ([1, 2, 3].every(n => tintColor.includes(n))) {
			imageData.data[i + 0] = 255 - originalRed;
			imageData.data[i + 1] = 255 - originalGreen;
			imageData.data[i + 2] = 255 - originalBlue;
		} else {
			// Strength increases amount of dye color
			const strength = 1.7;
			// Darkness helps preserve darkness / detail. Higher numbers preserve more darkness (very subtle)
			const darkness = 1.5;
			const rF = 1 + strength * (originalRed / 255) ** darkness;
			const gF = 1 + strength * (originalGreen / 255) ** darkness;
			const bF = 1 + strength * (originalBlue / 255) ** darkness;
			// Apply tint only to non-black (with tolerance) pixels
			imageData.data[i + 0] = Math.floor((originalRed + rF * r) / (1 + rF));
			imageData.data[i + 1] = Math.floor((originalGreen + gF * g) / (1 + gF));
			imageData.data[i + 2] = Math.floor((originalBlue + bF * b) / (1 + bF));
		}
	}

	ctx.putImageData(imageData, 0, 0);
	return canvas;
};

function toRGBA(color: [number, number, number, number?]) {
	const [r, g, b, a = 1] = color;
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

async function applyPatronPrismPaint(img: CanvasImage | Canvas, style: Extract<PaintStyle, { type: 'patron-prism' }>) {
	const base = await applyPaintToItemIcon(img, style.coreColor, 8);
	const width = img.width;
	const height = img.height;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	ctx.drawImage(base, 0, 0);

	const overlay = createCanvas(width, height);
	const oCtx = overlay.getContext('2d');
	const cx = width / 2;
	const cy = height / 2;
	const outerRadius = Math.min(width, height) / 2;
	const innerRadius = outerRadius * 0.38;
	const gradient = oCtx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
	for (const stop of [...style.ringStops].sort((a, b) => a.at - b.at)) {
		gradient.addColorStop(stop.at, toRGBA(stop.color));
	}
	oCtx.fillStyle = gradient;
	oCtx.fillRect(0, 0, width, height);

	ctx.globalCompositeOperation = 'lighter';
	ctx.drawImage(overlay, 0, 0);
	ctx.globalCompositeOperation = 'source-over';

	const centerShade = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerRadius);
	centerShade.addColorStop(0, 'rgba(8, 6, 12, 0.4)');
	centerShade.addColorStop(0.55, 'rgba(8, 6, 12, 0.15)');
	centerShade.addColorStop(1, 'rgba(8, 6, 12, 0)');
	ctx.fillStyle = centerShade;
	ctx.fillRect(0, 0, width, height);

	return canvas;
}

export async function getPaintedItemImage(paintColor: PaintColor, itemID: number) {
	const resultingImage = await OSRSCanvas.getItemImage({ itemID });
	if (paintColor.style?.type === 'patron-prism') {
		return applyPatronPrismPaint(resultingImage, paintColor.style);
	}
	return applyPaintToItemIcon(resultingImage, paintColor.rgb);
}

export const PaintBoxTable = new LootTable()
	.add('Gilded Gold paint can')
	.add('BSO Blurple paint can')
	.add('Guthix Green paint can')
	.add('TzHaar Orange paint can')
	.add('Vorkath Blue paint can')
	.add('Sapphire Blue paint can')
	.add('Pretty Pink paint can')
	.add('Zamorak Red paint can')
	.add('Abyssal Purple paint can')
	.add('Amethyst Purple paint can')
	.add('Ruby Red paint can')
	.add('Silver Light paint can')
	.add('Drakan Dark paint can')
	.add('Inversion paint can');
