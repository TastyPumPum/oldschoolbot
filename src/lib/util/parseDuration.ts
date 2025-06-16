import { Time } from 'e';

const regex = /(\d+)([smhd])/gi;

export function parseDuration(str: string): number | null {
	let duration = 0;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(str))) {
		const num = parseInt(match[1]);
		const unit = match[2].toLowerCase();
		if (unit === 's') duration += num * Time.Second;
		else if (unit === 'm') duration += num * Time.Minute;
		else if (unit === 'h') duration += num * Time.Hour;
		else if (unit === 'd') duration += num * Time.Day;
		else return null;
	}
	return duration > 0 ? duration : null;
}
