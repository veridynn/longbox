import { beforeEach, describe, expect, it } from 'vitest';
import { storedIssueListViewMode, storeIssueListViewMode } from './view-mode';

const storage = new Map<string, string>();

describe('issue list view mode storage', () => {
	beforeEach(() => {
		storage.clear();
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: {
				clear: () => storage.clear(),
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value)
			}
		});
	});

	it('stores valid view modes and falls back for invalid values', () => {
		expect(storedIssueListViewMode()).toBe('gallery');

		storeIssueListViewMode('list');
		expect(storedIssueListViewMode()).toBe('list');

		localStorage.setItem('longbox.issueListViewMode', 'bad');
		expect(storedIssueListViewMode()).toBe('gallery');
	});
});
