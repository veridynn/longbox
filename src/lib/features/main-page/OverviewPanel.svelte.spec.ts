import { page } from 'vite-plus/test/browser';
import { describe, expect, it } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import OverviewPanel from './OverviewPanel.svelte';

describe('OverviewPanel', () => {
	it('renders first-glance collection stats', async () => {
		render(OverviewPanel, {
			favoriteCount: 2,
			issueCount: 12,
			listCount: 3,
			readCount: 8,
			watchlistCount: 4
		});

		await expect.element(page.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
		await expect.element(page.getByText('Collection')).toBeInTheDocument();
		await expect.element(page.getByText('Favorites')).toBeInTheDocument();
		await expect.element(page.getByText('Watchlist')).toBeInTheDocument();
		await expect.element(page.getByText('Read')).toBeInTheDocument();
		await expect.element(page.getByText('Lists')).toBeInTheDocument();
		expect(
			Array.from(document.querySelectorAll('article p')).map((stat) => stat.textContent)
		).toEqual(['12', '2', '4', '8', '3']);
	});
});
