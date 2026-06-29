import { describe, expect, it } from 'vitest';
import {
	collectionItemKey,
	collectionListKey,
	creditKey,
	issueCharacterKey,
	recordIdForKey,
	userIssueKey
} from './import-keys';

describe('import keys', () => {
	it('creates stable per-user collection keys', () => {
		expect(collectionListKey('user-1')).toBe('user-1:collection');
		expect(userIssueKey('user-1', 123)).toBe('user-1:comicvine:123');
		expect(collectionItemKey('user-1', 123)).toBe('user-1:collection:comicvine:123');
	});

	it('creates normalized credit and character keys', () => {
		expect(creditKey(123, 456, 'Cover Artist')).toBe('comicvine:123:person:456:role:cover-artist');
		expect(creditKey(123, 456, '')).toBe('comicvine:123:person:456:role:credit');
		expect(issueCharacterKey(123, 789)).toBe('comicvine:123:character:789');
	});

	it('creates deterministic UUID record ids', () => {
		const collectionKey = collectionListKey('user-1');
		const otherCollectionKey = collectionListKey('user-2');

		expect(recordIdForKey(collectionKey)).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
		);
		expect(recordIdForKey(collectionKey)).toBe(recordIdForKey(collectionKey));
		expect(recordIdForKey(collectionKey)).not.toBe(recordIdForKey(otherCollectionKey));
	});
});
