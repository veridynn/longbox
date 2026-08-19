import { describe, expect, it } from 'vite-plus/test';
import {
	customListItemKey,
	isDuplicateListItemError,
	listHasCollectionItem,
	listHasSearchIssue,
	reorderedListItems,
	reorderedListPositions,
	stableUserIssueKey,
	validateListName
} from './lists';

describe('validateListName', () => {
	it('rejects blank names', () => {
		expect(validateListName('   ', [])).toBe('Enter a list name.');
	});

	it.each(['Collection', 'favorites', 'WATCHLIST'])('rejects the reserved name %s', (name) => {
		expect(validateListName(name, [])).toBe('A list with this name already exists.');
	});

	it('rejects case-insensitive duplicate names', () => {
		expect(validateListName('  To Read ', ['to read'])).toBe(
			'A list with this name already exists.'
		);
	});

	it('allows the current list name when renaming', () => {
		expect(validateListName('  To Read ', ['Collection', 'to read'], 'To read')).toBeNull();
	});

	it('accepts a unique name', () => {
		expect(validateListName('Indie picks', ['To read'])).toBeNull();
	});

	it('builds deterministic custom list item keys', () => {
		expect(stableUserIssueKey('user-1', 123)).toBe('user-1:comicvine:123');
		expect(customListItemKey('user-1:custom:list-1', 'user-1:comicvine:123')).toBe(
			'user-1:custom:list-1:userIssue:user-1:comicvine:123'
		);
	});
});

describe('list item helpers', () => {
	const listItems = [
		{
			id: 'item-1',
			position: 0,
			userIssue: {
				id: 'user-issue-1',
				issue: { id: 'issue-1', comicVineId: 101, issueNumber: '1' }
			}
		},
		{
			id: 'item-2',
			position: 1,
			userIssue: {
				id: 'user-issue-2',
				issue: { id: 'issue-2', comicVineId: 202, issueNumber: '2' }
			}
		},
		{
			id: 'item-3',
			position: 2,
			userIssue: {
				id: 'user-issue-3',
				issue: { id: 'issue-3', comicVineId: 303, issueNumber: '3' }
			}
		}
	];

	it('detects duplicate collection items by user issue, ComicVine id, and pending state', () => {
		expect(
			listHasCollectionItem(
				listItems,
				{
					id: 'new-item',
					position: 0,
					userIssue: {
						id: 'user-issue-4',
						issue: { id: 'issue-4', comicVineId: 202, issueNumber: '2' }
					}
				},
				[]
			)
		).toBe(true);
		expect(
			listHasCollectionItem(
				listItems,
				{
					id: 'new-item',
					position: 0,
					userIssue: {
						id: 'user-issue-4',
						issue: { id: 'issue-4', comicVineId: 404, issueNumber: '4' }
					}
				},
				['user-issue-4']
			)
		).toBe(true);
	});

	it('detects duplicate search issues by ComicVine id and pending state', () => {
		expect(
			listHasSearchIssue(
				listItems,
				{
					id: 202,
					name: null,
					issueNumber: '2',
					coverDate: null,
					coverImageUrl: null,
					volume: {
						id: 1,
						name: 'Series',
						startYear: null,
						issueCount: null,
						coverImageUrl: null,
						publisher: null
					},
					siteDetailUrl: null
				},
				[]
			)
		).toBe(true);
		expect(
			listHasSearchIssue(
				listItems,
				{
					id: 404,
					name: null,
					issueNumber: '4',
					coverDate: null,
					coverImageUrl: null,
					volume: {
						id: 1,
						name: 'Series',
						startYear: null,
						issueCount: null,
						coverImageUrl: null,
						publisher: null
					},
					siteDetailUrl: null
				},
				[404]
			)
		).toBe(true);
	});

	it('calculates reordered positions', () => {
		expect(reorderedListItems(listItems, 'item-1', 'item-3').map((item) => item.id)).toEqual([
			'item-2',
			'item-3',
			'item-1'
		]);
		expect(reorderedListPositions(listItems, 'item-1', 'item-3')).toEqual([
			{ id: 'item-2', position: 0 },
			{ id: 'item-3', position: 1 },
			{ id: 'item-1', position: 2 }
		]);
		expect(reorderedListPositions(listItems, 'item-3', 'item-1')).toEqual([
			{ id: 'item-3', position: 0 },
			{ id: 'item-1', position: 1 },
			{ id: 'item-2', position: 2 }
		]);
		expect(reorderedListPositions(listItems, 'item-2', 'item-2')).toEqual([]);
	});

	it('recognizes duplicate list item errors', () => {
		expect(isDuplicateListItemError(new Error('unique constraint failed: listItemKey'))).toBe(true);
		expect(isDuplicateListItemError(new Error('network failed'))).toBe(false);
	});
});
