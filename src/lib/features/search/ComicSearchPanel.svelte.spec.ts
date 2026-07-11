import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import ComicSearchPanel from './ComicSearchPanel.svelte';

describe('ComicSearchPanel', () => {
	it('renders partial volume-name search results', async () => {
		render(ComicSearchPanel, {
			addError: null,
			addingIssueIds: [],
			isInCollection: () => false,
			isSearching: false,
			onAddIssue: vi.fn(),
			onSearch: vi.fn(),
			open: true,
			query: 'man',
			resultLimit: 12,
			results: [
				{
					id: 286879,
					name: 'In Storybook Endings',
					issueNumber: '713',
					coverDate: '2011-10-01',
					coverImageUrl: null,
					volume: { id: 796, name: 'Batman' },
					apiDetailUrl: null,
					siteDetailUrl: null
				}
			],
			searchError: null
		});

		await expect
			.element(page.getByRole('heading', { name: 'Batman #713: In Storybook Endings' }))
			.toBeInTheDocument();
	});
});
