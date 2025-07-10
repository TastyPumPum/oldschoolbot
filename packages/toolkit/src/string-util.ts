export function cleanString(str: string) {
	return str.replace(/[^0-9a-zA-Z+]/gi, '').toUpperCase();
}

export function stringMatches(str: string | number = '', str2: string | number = '') {
	return cleanString(str.toString()) === cleanString(str2.toString());
}

export function replaceWhitespaceAndUppercase(str: string): string {
	return str.replace(/\s/g, '').toUpperCase();
}

export function toTitleCase(str: string) {
	const splitStr = str.toLowerCase().split(' ');
	for (let i = 0; i < splitStr.length; i++) {
		splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
	}
	return splitStr.join(' ');
}

export function truncateString(str: string, maxLen: number) {
	if (str.length < maxLen) return str;
	return `${str.slice(0, maxLen - 3)}...`;
}

const validChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function miniID(length: number): string {
	let id = '';

	for (let i = 0; i < length; i++) {
		const randomChar = validChars[Math.floor(Math.random() * validChars.length)];

		id += randomChar;
	}

	return id;
}
