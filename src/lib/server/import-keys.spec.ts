import { describe, expect, it } from 'vitest';
import {
	creditKey,
	issueCharacterKey,
	listItemKey,
	listKey,
	recordIdForKey,
	userIssueKey
} from './import-keys';

describe('import keys', () => {
	it('creates stable per-user library keys', () => {
		expect(listKey('user-1')).toBe('user-1:library');
		expect(userIssueKey('user-1', 123)).toBe('user-1:comicvine:123');
		expect(listItemKey('user-1', 123)).toBe('user-1:library:comicvine:123');
	});

	it('creates normalized credit and character keys', () => {
		expect(creditKey(123, 456, 'Cover Artist')).toBe('comicvine:123:person:456:role:cover-artist');
		expect(creditKey(123, 456, '')).toBe('comicvine:123:person:456:role:credit');
		expect(issueCharacterKey(123, 789)).toBe('comicvine:123:character:789');
	});

	it('creates deterministic UUID record ids', () => {
		expect(recordIdForKey('user-1:library')).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
		expect(recordIdForKey('user-1:library')).toBe(recordIdForKey('user-1:library'));
		expect(recordIdForKey('user-1:library')).not.toBe(recordIdForKey('user-2:library'));
	});
});
