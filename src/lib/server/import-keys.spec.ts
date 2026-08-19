import { describe, expect, it } from 'vitest';
import { creditKey, issueCharacterKey, recordIdForKey, userIssueKey } from './import-keys';

describe('import keys', () => {
	it('creates stable per-user issue keys', () => {
		expect(userIssueKey('user-1', 123)).toBe('user-1:comicvine:123');
	});

	it('creates normalized credit and character keys', () => {
		expect(creditKey(123, 456, 'Cover Artist')).toBe('comicvine:123:person:456:role:cover-artist');
		expect(creditKey(123, 456, '')).toBe('comicvine:123:person:456:role:credit');
		expect(issueCharacterKey(123, 789)).toBe('comicvine:123:character:789');
	});

	it('creates deterministic UUID record ids', () => {
		const key = userIssueKey('user-1', 123);
		const otherKey = userIssueKey('user-2', 123);

		expect(recordIdForKey(key)).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
		expect(recordIdForKey(key)).toBe(recordIdForKey(key));
		expect(recordIdForKey(key)).not.toBe(recordIdForKey(otherKey));
	});
});
