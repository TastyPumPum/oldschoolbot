import { AttachmentBuilder } from 'discord.js';
import { toKMB } from 'oldschooljs';

import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';

export type HighRollerImageEntry = {
	position: number;
	username: string;
	itemID: number;
	itemName: string;
	value: number;
};

export async function drawHighRollerImage({
	rolls
}: {
	rolls: HighRollerImageEntry[];
}): Promise<AttachmentBuilder | null> {
	if (rolls.length === 0) {
		return null;
	}

	const padding = 20;
	const headerHeight = 40;
	const rowHeight = 48;
	const width = 520;
	const height = padding * 2 + headerHeight + rowHeight * rolls.length;

	const canvas = new OSRSCanvas({ width, height });

	// Background
	canvas.ctx.fillStyle = '#1a1a1a';
	canvas.ctx.fillRect(0, 0, width, height);

	// Header
	canvas.drawTitleText({ text: 'High Roller Results', x: Math.floor(width / 2), y: padding + 4, center: true });

	for (const [index, roll] of rolls.entries()) {
		const rowTop = padding + headerHeight + index * rowHeight;
		const iconX = padding;
		const iconY = rowTop + 4;
		await canvas.drawItemIDSprite({ itemID: roll.itemID, x: iconX, y: iconY });

		const textX = iconX + 52;
		canvas.drawText({
			text: `${roll.position}. ${roll.username}`,
			x: textX,
			y: rowTop + 20,
			color: OSRSCanvas.COLORS.WHITE,
			font: 'Bold'
		});
		canvas.drawText({
			text: `${roll.itemName} (${toKMB(roll.value)} GP)`,
			x: textX,
			y: rowTop + 36,
			color: OSRSCanvas.COLORS.YELLOW
		});
	}

	const buffer = await canvas.toScaledOutput(2);
	return new AttachmentBuilder(buffer, { name: 'high-roller-results.png' });
}
