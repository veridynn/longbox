import { describe, expect, it } from 'vite-plus/test';
import { IssueSort, isIssueSortKey, resolvedIssueSortKey, sortedIssueItems } from './sort';

describe('issue sorting', () => {
	const items = [
		{
			id: 'item-10',
			addedAt: new Date('2024-03-01T00:00:00.000Z'),
			userIssue: {
				id: 'user-issue-10',
				issue: {
					id: 'issue-10',
					issueNumber: '10',
					name: 'Ten',
					volume: { id: 'volume-1', name: 'Saga' }
				}
			}
		},
		{
			id: 'item-2',
			addedAt: new Date('2024-02-01T00:00:00.000Z'),
			userIssue: {
				id: 'user-issue-2',
				issue: {
					id: 'issue-2',
					issueNumber: '2',
					name: 'Two',
					volume: { id: 'volume-1', name: 'Saga' }
				}
			}
		},
		{
			id: 'item-2b',
			addedAt: new Date('2024-01-01T00:00:00.000Z'),
			userIssue: {
				id: 'user-issue-2b',
				issue: {
					id: 'issue-2b',
					issueNumber: '2B',
					name: 'Two B',
					volume: { id: 'volume-1', name: 'Saga' }
				}
			}
		}
	];

	it('recognizes valid sort keys', () => {
		expect(isIssueSortKey(IssueSort.Custom)).toBe(true);
		expect(isIssueSortKey(IssueSort.NewestAdded)).toBe(true);
		expect(isIssueSortKey(IssueSort.OldestAdded)).toBe(true);
		expect(isIssueSortKey(IssueSort.IssueNumberAsc)).toBe(true);
		expect(isIssueSortKey('unknown')).toBe(false);
	});

	it('resolves URL sort before saved sort and fallback', () => {
		expect(
			resolvedIssueSortKey(IssueSort.IssueNumberDesc, IssueSort.Custom, IssueSort.Custom)
		).toBe(IssueSort.IssueNumberDesc);
		expect(resolvedIssueSortKey('nope', IssueSort.IssueNumberAsc, IssueSort.Custom)).toBe(
			IssueSort.IssueNumberAsc
		);
		expect(resolvedIssueSortKey('nope', null, IssueSort.NewestAdded)).toBe(IssueSort.NewestAdded);
	});

	it('sorts by issue number naturally', () => {
		expect(sortedIssueItems(items, IssueSort.IssueNumberAsc).map((item) => item.id)).toEqual([
			'item-2',
			'item-2b',
			'item-10'
		]);
	});

	it('preserves order for custom and ties', () => {
		expect(sortedIssueItems(items, IssueSort.Custom).map((item) => item.id)).toEqual([
			'item-10',
			'item-2',
			'item-2b'
		]);
	});

	it('sorts by issue number descending', () => {
		expect(sortedIssueItems(items, IssueSort.IssueNumberDesc).map((item) => item.id)).toEqual([
			'item-10',
			'item-2b',
			'item-2'
		]);
	});

	it('sorts by recently added', () => {
		expect(sortedIssueItems(items, IssueSort.NewestAdded).map((item) => item.id)).toEqual([
			'item-10',
			'item-2',
			'item-2b'
		]);
		expect(sortedIssueItems(items, IssueSort.OldestAdded).map((item) => item.id)).toEqual([
			'item-2b',
			'item-2',
			'item-10'
		]);
	});
});
