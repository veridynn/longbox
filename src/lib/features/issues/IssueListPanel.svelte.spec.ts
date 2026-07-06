import { createRawSnippet } from 'svelte';
import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import IssueListPanel from './IssueListPanel.svelte';

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

describe('IssueListPanel', () => {
	it('renders gallery cover cards with overlay info', async () => {
		render(IssueListPanel, {
			items,
			onRemoveListItem: vi.fn(),
			onViewModeChange: vi.fn(),
			viewMode: 'gallery'
		});

		await expect.element(page.getByRole('link', { name: /Saga #1/ })).toBeInTheDocument();
		await expect.element(page.getByText('Image · Jan 2024')).toBeInTheDocument();
		expect(page.getByRole('button', { name: /Remove Saga #1/ })).not.toBeInTheDocument();
	});

	it('switches to list mode through the view callback', async () => {
		const onViewModeChange = vi.fn();
		render(IssueListPanel, {
			items,
			onViewModeChange,
			viewMode: 'gallery'
		});

		await page.getByRole('button', { name: 'List view' }).click();

		expect(onViewModeChange).toHaveBeenCalledWith('list');
	});

	it('shows remove and drag controls only when callbacks are provided', async () => {
		const onRemoveListItem = vi.fn();
		render(IssueListPanel, {
			items,
			onRemoveListItem,
			onReorderItems: vi.fn(),
			onViewModeChange: vi.fn(),
			viewMode: 'list'
		});

		await expect.element(page.getByRole('button', { name: /Drag Saga #1/ })).toBeInTheDocument();
		await page.getByRole('button', { name: /Remove Saga #1/ }).click();

		expect(onRemoveListItem).toHaveBeenCalledWith('item-1');
	});

	it('renders dense list columns and list membership links', async () => {
		render(IssueListPanel, {
			currentListId: 'list-b',
			items,
			onViewModeChange: vi.fn(),
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
		render(IssueListPanel, {
			items,
			onUpdateUserIssue,
			onViewModeChange: vi.fn(),
			viewMode: 'list'
		});

		await page.getByRole('button', { name: 'Mark as not owned' }).click();
		await page.getByRole('button', { name: 'Mark as unread' }).click();
		await page.getByRole('button', { name: 'Remove favorite' }).click();
		await page.getByRole('button', { name: 'Clear 4 star rating' }).click();

		expect(onUpdateUserIssue).toHaveBeenNthCalledWith(1, 'user-issue-1', { owned: false });
		expect(onUpdateUserIssue).toHaveBeenNthCalledWith(2, 'user-issue-1', { readStatus: 'unread' });
		expect(onUpdateUserIssue).toHaveBeenNthCalledWith(3, 'user-issue-1', { favorite: false });
		expect(onUpdateUserIssue).toHaveBeenNthCalledWith(4, 'user-issue-1', { rating: null });
	});

	it('previews added and removed rating stars on hover', async () => {
		render(IssueListPanel, {
			items,
			onUpdateUserIssue: vi.fn(),
			onViewModeChange: vi.fn(),
			viewMode: 'list'
		});

		const secondStar = page.getByRole('button', { name: 'Set rating to 2 stars' }).first();
		const fourthStar = page.getByRole('button', { name: 'Clear 4 star rating' });
		const fifthStar = page.getByRole('button', { name: 'Set rating to 5 stars' }).first();

		await fifthStar.hover();
		await expect.element(fourthStar).toHaveAttribute('data-rating-tone', 'solid');
		await expect.element(fifthStar).toHaveAttribute('data-rating-tone', 'preview');

		await secondStar.hover();
		await expect.element(secondStar).toHaveAttribute('data-rating-tone', 'solid');
		await expect.element(fourthStar).toHaveAttribute('data-rating-tone', 'preview');
	});

	it('renders loading, error, and empty states', async () => {
		const { unmount } = render(IssueListPanel, {
			empty,
			isLoading: true,
			items: [],
			onViewModeChange: vi.fn(),
			viewMode: 'gallery'
		});

		await expect.element(page.getByText('Loading issues')).toBeInTheDocument();
		await unmount();

		const errorRender = render(IssueListPanel, {
			errorMessage: 'Unable to load issues.',
			items: [],
			onViewModeChange: vi.fn(),
			viewMode: 'gallery'
		});

		await expect.element(page.getByText('Unable to load issues.')).toBeInTheDocument();
		await errorRender.unmount();

		render(IssueListPanel, {
			empty,
			items: [],
			onViewModeChange: vi.fn(),
			viewMode: 'gallery'
		});

		await expect.element(page.getByText('No issues yet')).toBeInTheDocument();
	});
});
