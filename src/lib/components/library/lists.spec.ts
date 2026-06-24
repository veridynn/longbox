import { describe, expect, it } from 'vite-plus/test';
import { customListItemKey, validateListName } from './lists';

describe('validateListName', () => {
	it('rejects blank names', () => {
		expect(validateListName('   ', [])).toBe('Enter a list name.');
	});

	it.each(['Library', 'favorites', 'WATCHLIST'])('rejects the reserved name %s', (name) => {
		expect(validateListName(name, [])).toBe('A list with this name already exists.');
	});

	it('rejects case-insensitive duplicate names', () => {
		expect(validateListName('  To Read ', ['to read'])).toBe(
			'A list with this name already exists.'
		);
	});

	it('accepts a unique name', () => {
		expect(validateListName('Indie picks', ['To read'])).toBeNull();
	});

	it('builds deterministic custom list item keys', () => {
		expect(customListItemKey('user-1:custom:list-1', 'issue-1')).toBe(
			'user-1:custom:list-1:userIssue:issue-1'
		);
	});
});
