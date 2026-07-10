import { createRawSnippet } from 'svelte';
import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import IssueListPanel from './IssueListPanel.svelte';
import { IssueSort } from './sort';
import { ConfirmDeleteDialog } from '$lib/components/ui/confirm-delete-dialog';

const items = [
	{
		id: 'item-1',
		position: 0,
		userIssue: {
			id: 'user-issue-1',
			acquiredAt: new Date('2024-02-01T00:00:00.000Z'),
			favorite: true,
			owned: true,
			rating: 4,
			readStatus: 'read',
			listItems: [
				{ id: 'list-item-a', list: { id: 'list-a', name: 'Favorites' } },
				{ id: 'list-item-b', list: { id: 'list-b', name: 'Current list' } }
			],
			issue: {
				id: 'issue-1',
				coverDate: new Date('2024-01-01T00:00:00.000Z'),
				coverImageUrl: 'https://img.example/cover.jpg',
				issueNumber: '1',
				name: 'First',
				issueCharacters: [
					{ id: 'appearance-1', character: { id: 'character-1', name: 'Alana' } },
					{ id: 'appearance-2', character: { id: 'character-2', name: 'Marko' } }
				],
				volume: { id: 'volume-1', name: 'Saga', publisher: { id: 'publisher-1', name: 'Image' } }
			}
		}
	},
	{
		id: 'item-2',
		position: 1,
		userIssue: {
			id: 'user-issue-2',
			favorite: false,
			owned: false,
			rating: 0,
			readStatus: 'unread',
			issue: {
				id: 'issue-2',
				coverDate: null,
				coverImageUrl: null,
				issueNumber: '2',
				name: 'Second',
				volume: { id: 'volume-1', name: 'Saga', publisher: { id: 'publisher-1', name: 'Image' } }
			}
		}
	}
];

const empty = createRawSnippet(() => ({
	render: () => '<p>No issues yet</p>'
}));

function pressRating(label: string, key: string) {
	document
		.querySelector(`[aria-label="${label}"]`)
		?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
}

function renderPanel(props = {}) {
	return render(IssueListPanel, {
		items,
		onSortKeyChange: vi.fn(),
		onViewModeChange: vi.fn(),
		sortKey: IssueSort.NewestAdded,
		viewMode: 'gallery',
		...props
	});
}

describe('IssueListPanel', () => {
	it('renders gallery cover cards with overlay info', async () => {
		renderPanel({ onRemoveListItem: vi.fn() });

		await expect.element(page.getByRole('link', { name: /Saga #1/ })).toBeInTheDocument();
		await expect.element(page.getByText('Image · Jan 2024')).toBeInTheDocument();
		expect(page.getByRole('button', { name: /Delete Saga #1/ })).not.toBeInTheDocument();
	});

	it('switches to list mode through the view callback', async () => {
		const onViewModeChange = vi.fn();
		renderPanel({ onViewModeChange });

		await page.getByRole('button', { name: 'List view' }).click();

		expect(onViewModeChange).toHaveBeenCalledWith('list');
	});

	it('shows remove and drag controls only when custom sorting is enabled', async () => {
		const onRemoveListItem = vi.fn();
		render(ConfirmDeleteDialog);
		const { unmount } = renderPanel({
			onRemoveListItem,
			onReorderItems: vi.fn(),
			removeFromList: true,
			sortKey: IssueSort.Custom,
			userSortable: true,
			viewMode: 'list'
		});

		await expect.element(page.getByRole('button', { name: /Drag Saga #1/ })).toBeInTheDocument();
		await page.getByRole('button', { name: /Remove Saga #1/ }).click();
		expect(onRemoveListItem).not.toHaveBeenCalled();
		await expect
			.element(
				page.getByText(
					'This action cannot be undone. The issue will be removed from this list, but it will remain in your collection.'
				)
			)
			.toBeInTheDocument();
		expect(page.getByRole('textbox', { name: 'Confirmation text' })).not.toBeInTheDocument();
		(document.querySelector('[data-alert-dialog-action]') as HTMLButtonElement).click();

		expect(onRemoveListItem).toHaveBeenCalledWith('item-1');
		await unmount();

		renderPanel({
			onReorderItems: vi.fn(),
			sortKey: IssueSort.IssueNumberAsc,
			userSortable: true,
			viewMode: 'list'
		});

		expect(page.getByRole('button', { name: /Drag Saga #1/ })).not.toBeInTheDocument();
	});

	it('skips remove confirmation on shift-click', async () => {
		const onRemoveListItem = vi.fn();
		render(ConfirmDeleteDialog);
		renderPanel({
			onRemoveListItem,
			removeFromList: true,
			sortKey: IssueSort.Custom,
			viewMode: 'list'
		});

		document
			.querySelector('[aria-label="Remove Saga #1: First"]')
			?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));

		expect(onRemoveListItem).toHaveBeenCalledWith('item-1');
		expect(page.getByRole('heading', { name: 'Remove from list' })).not.toBeInTheDocument();
	});

	it('renders dense list columns and list membership links', async () => {
		renderPanel({
			currentListId: 'list-b',
			viewMode: 'list'
		});

		await expect.element(page.getByRole('link', { name: '#1' })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'First' })).toBeInTheDocument();
		await expect.element(page.getByText('Saga').first()).toBeInTheDocument();
		expect(page.getByRole('table')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Favorites' }))
			.toHaveAttribute('href', '/list/list-a');
		expect(page.getByText('Characters')).not.toBeInTheDocument();
		expect(page.getByText('Acquired')).not.toBeInTheDocument();
		expect(page.getByRole('link', { name: 'Current list' })).not.toBeInTheDocument();
	});

	it('updates status icons and rating inline', async () => {
		const onUpdateUserIssue = vi.fn();
		renderPanel({
			onUpdateUserIssue,
			viewMode: 'list'
		});

		await page.getByRole('button', { name: 'Mark as not owned' }).click();
		await page.getByRole('button', { name: 'Mark as unread' }).click();
		await page.getByRole('button', { name: 'Remove favorite' }).click();
		pressRating('Rating for Saga #1: First', 'ArrowLeft');

		expect(onUpdateUserIssue).toHaveBeenNthCalledWith(1, 'user-issue-1', { owned: false });
		expect(onUpdateUserIssue).toHaveBeenNthCalledWith(2, 'user-issue-1', { readStatus: 'unread' });
		expect(onUpdateUserIssue).toHaveBeenNthCalledWith(3, 'user-issue-1', { favorite: false });
		expect(onUpdateUserIssue).toHaveBeenNthCalledWith(4, 'user-issue-1', { rating: 3 });
	});

	it('renders loading, error, and empty states', async () => {
		const { unmount } = renderPanel({
			empty,
			isLoading: true,
			items: []
		});

		await expect.element(page.getByText('Loading issues')).toBeInTheDocument();
		await unmount();

		const errorRender = renderPanel({
			errorMessage: 'Unable to load issues.',
			items: []
		});

		await expect.element(page.getByText('Unable to load issues.')).toBeInTheDocument();
		await errorRender.unmount();

		renderPanel({
			empty,
			items: []
		});

		await expect.element(page.getByText('No issues yet')).toBeInTheDocument();
	});

	it('hides custom sorting when user sorting is disabled', async () => {
		renderPanel({ userSortable: false });

		await page.getByRole('button', { name: /Sort issues:/ }).click();
		expect(page.getByRole('button', { name: 'Custom order', exact: true })).not.toBeInTheDocument();
	});

	it('shows custom sorting when user sorting is enabled', async () => {
		renderPanel({ sortKey: IssueSort.Custom, userSortable: true });

		await page.getByRole('button', { name: /Sort issues:/ }).click();
		await expect
			.element(page.getByRole('button', { name: 'Custom order', exact: true }))
			.toBeInTheDocument();
	});

	it('emits sort changes from the sort menu', async () => {
		const onSortKeyChange = vi.fn();
		renderPanel({ onSortKeyChange });

		await page.getByRole('button', { name: /Sort issues:/ }).click();
		await page.getByRole('button', { name: 'Issue # descending' }).click();

		expect(onSortKeyChange).toHaveBeenCalledWith(IssueSort.IssueNumberDesc);
	});
});
