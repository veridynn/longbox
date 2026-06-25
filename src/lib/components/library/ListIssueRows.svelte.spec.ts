import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import ListIssueRows from './ListIssueRows.svelte';

const items = [
	{
		id: 'item-1',
		position: 0,
		userIssue: {
			id: 'user-issue-1',
			issue: {
				id: 'issue-1',
				comicVineId: 101,
				coverDate: new Date('2024-01-01T00:00:00.000Z'),
				coverImageUrl: null,
				issueNumber: '1',
				name: 'First',
				volume: { id: 'volume-1', name: 'Saga', publisher: { id: 'publisher-1', name: 'Image' } }
			}
		}
	},
	{
		id: 'item-2',
		position: 1,
		userIssue: {
			id: 'user-issue-2',
			issue: {
				id: 'issue-2',
				comicVineId: 202,
				coverDate: null,
				coverImageUrl: null,
				issueNumber: '2',
				name: 'Second',
				volume: { id: 'volume-1', name: 'Saga', publisher: { id: 'publisher-1', name: 'Image' } }
			}
		}
	}
];

describe('ListIssueRows', () => {
	it('removes a list item without hiding issue links', async () => {
		const onRemoveListItem = vi.fn();
		render(ListIssueRows, {
			items,
			onRemoveListItem,
			onReorderListItems: vi.fn()
		});

		await expect.element(page.getByRole('link', { name: /Saga #1/ })).toBeInTheDocument();
		(
			Array.from(document.querySelectorAll('button')).find((button) =>
				button.textContent?.includes('Remove')
			) as HTMLButtonElement
		).click();

		expect(onRemoveListItem).toHaveBeenCalledWith('item-1');
	});

	it('renders drag handles without turning issue links into drag sources', async () => {
		render(ListIssueRows, {
			items,
			onRemoveListItem: vi.fn(),
			onReorderListItems: vi.fn()
		});

		expect(document.querySelectorAll('[data-list-drag-handle]')).toHaveLength(2);
		expect(page.getByRole('link', { name: /Saga #1/ })).not.toHaveAttribute('draggable');
		expect(document.querySelector('.fixed.z-50')).toBeNull();
	});
});
