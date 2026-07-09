import { describe, expect, it } from 'vitest';
import { IssueListView, isIssueListViewMode, resolvedIssueListViewMode } from './view-mode';

describe('issue list view mode', () => {
	it('recognizes valid view modes', () => {
		expect(isIssueListViewMode('gallery')).toBe(true);
		expect(isIssueListViewMode('list')).toBe(true);
		expect(isIssueListViewMode('bad')).toBe(false);
		expect(isIssueListViewMode(null)).toBe(false);
	});

	it('resolves URL view before saved view and fallback', () => {
		expect(
			resolvedIssueListViewMode(IssueListView.List, IssueListView.Gallery, IssueListView.Gallery)
		).toBe(IssueListView.List);
		expect(resolvedIssueListViewMode('bad', IssueListView.List, IssueListView.Gallery)).toBe(
			IssueListView.List
		);
		expect(resolvedIssueListViewMode('bad', null, IssueListView.Gallery)).toBe(
			IssueListView.Gallery
		);
	});
});
