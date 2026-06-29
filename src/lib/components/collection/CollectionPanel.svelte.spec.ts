import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import CollectionPanel from './CollectionPanel.svelte';

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
		render(CollectionPanel, {
			errorMessage: null,
			isLoading: false,
			items,
			onReorderItems: vi.fn()
		});

		await expect.element(page.getByLabelText('View mode')).toBeInTheDocument();
		await expect.element(page.getByLabelText('Search collection')).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: /Saga #1/ })).toBeInTheDocument();
		await page.getByRole('button', { name: 'List view' }).click();
		await expect.element(page.getByRole('button', { name: /Drag Saga #1/ })).toBeInTheDocument();
		expect(page.getByRole('button', { name: /Remove/ })).not.toBeInTheDocument();
	});
});
