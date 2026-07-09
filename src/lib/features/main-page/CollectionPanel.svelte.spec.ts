import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import CollectionPanel from './CollectionPanel.svelte';
import { IssueSort } from '$lib/features/issues/sort';

const items = [
	{
		id: 'item-1',
		position: 0,
		userIssue: {
			id: 'user-issue-1',
			issue: {
				id: 'issue-1',
				coverDate: new Date('2024-01-01T00:00:00.000Z'),
				coverImageUrl: 'https://img.example/cover.jpg',
				issueNumber: '1',
				name: 'First',
				volume: { id: 'volume-1', name: 'Saga', publisher: { id: 'publisher-1', name: 'Image' } }
			}
		}
	}
];

describe('CollectionPanel', () => {
	it('renders the shared issue view without list-management controls', async () => {
		const onRemoveIssue = vi.fn();
		render(CollectionPanel, {
			errorMessage: null,
			isLoading: false,
			items,
			onAddIssue: vi.fn(),
			onRemoveIssue,
			onSortKeyChange: vi.fn(),
			onViewModeChange: vi.fn(),
			sortKey: IssueSort.NewestAdded,
			viewMode: 'list'
		});

		await expect.element(page.getByRole('heading', { name: 'Collection' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('View mode')).toBeInTheDocument();
		expect(page.getByLabelText('Search collection')).not.toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: '#1' })).toBeInTheDocument();
		await expect.element(page.getByText('Saga')).toBeInTheDocument();
		expect(page.getByRole('button', { name: /Drag Saga #1/ })).not.toBeInTheDocument();
		await page.getByRole('button', { name: /Remove Saga #1/ }).click();
		expect(onRemoveIssue).toHaveBeenCalledWith('item-1');
	});

	it('prompts users to add their first issue when empty', async () => {
		const onAddIssue = vi.fn();
		render(CollectionPanel, {
			errorMessage: null,
			isLoading: false,
			items: [],
			onAddIssue,
			onSortKeyChange: vi.fn(),
			onViewModeChange: vi.fn(),
			sortKey: IssueSort.NewestAdded,
			viewMode: 'gallery'
		});

		await expect.element(page.getByText('Your collection is empty')).toBeInTheDocument();
		await expect
			.element(page.getByText('Add your first issue to start building your collection.'))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Add first issue' }).click();

		expect(onAddIssue).toHaveBeenCalledOnce();
	});
});
