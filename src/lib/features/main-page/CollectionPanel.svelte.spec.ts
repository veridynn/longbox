import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import CollectionPanel from './CollectionPanel.svelte';
import { IssueSort } from '$lib/features/issues/sort';
import { ConfirmDeleteDialog } from '$lib/components/ui/confirm-delete-dialog';

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
		render(ConfirmDeleteDialog);
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
		await page.getByRole('button', { name: /Delete Saga #1/ }).click();
		expect(onRemoveIssue).not.toHaveBeenCalled();
		await expect
			.element(
				page.getByText(
					'This action cannot be undone. The issue will be deleted from your collection and every list.'
				)
			)
			.toBeInTheDocument();
		expect(page.getByRole('textbox', { name: 'Confirmation text' })).not.toBeInTheDocument();
		(document.querySelector('[data-alert-dialog-action]') as HTMLButtonElement).click();
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

	it('contains list overflow within the main-page section', async () => {
		const responsiveItems = [
			{
				...items[0],
				userIssue: {
					...items[0].userIssue,
					issue: {
						...items[0].userIssue.issue,
						name: 'A deliberately long issue title for responsive layout coverage',
						volume: {
							...items[0].userIssue.issue.volume,
							name: 'A deliberately long volume name'
						}
					}
				}
			}
		];
		const { container } = render(CollectionPanel, {
			errorMessage: null,
			isLoading: false,
			items: responsiveItems,
			onAddIssue: vi.fn(),
			onRemoveIssue: vi.fn(),
			onSortKeyChange: vi.fn(),
			onViewModeChange: vi.fn(),
			sortKey: IssueSort.NewestAdded,
			viewMode: 'list'
		});
		const grid = container.querySelector<HTMLElement>('[data-list-grid]');
		const scroller = grid?.parentElement;

		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.width = '320px';
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

		expect(container.scrollWidth).toBe(container.clientWidth);
		expect(scroller?.scrollWidth).toBeGreaterThan(scroller?.clientWidth ?? 0);
	});
});
