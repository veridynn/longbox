import { createHash } from 'node:crypto';

const UUID_NAMESPACE = '7c885f68-d620-4f24-8a38-65cf9b0f9427';

function keyPart(value: string | number) {
	return String(value)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export function userIssueKey(ownerId: string, issueComicVineId: number) {
	return `${ownerId}:comicvine:${issueComicVineId}`;
}

export function creditKey(issueComicVineId: number, personComicVineId: number, role: string) {
	return `comicvine:${issueComicVineId}:person:${personComicVineId}:role:${keyPart(role) || 'credit'}`;
}

export function issueCharacterKey(issueComicVineId: number, characterComicVineId: number) {
	return `comicvine:${issueComicVineId}:character:${characterComicVineId}`;
}

export function recordIdForKey(key: string) {
	const namespaceBytes = Buffer.from(UUID_NAMESPACE.replaceAll('-', ''), 'hex');
	const hash = createHash('sha1').update(namespaceBytes).update(key).digest();
	const bytes = Buffer.from(hash.subarray(0, 16));

	bytes[6] = (bytes[6] & 0x0f) | 0x50;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = bytes.toString('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
