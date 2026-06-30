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
			issue: {
				id: 'issue-1',
				coverDate: new Date('2024-01-01T00:00:00.000Z'),
				coverImageUrl: 'https://img.example/cover.jpg',
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
		await page.getByRole('button', { name: 'Remove' }).first().click();

		expect(onRemoveListItem).toHaveBeenCalledWith('item-1');
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
