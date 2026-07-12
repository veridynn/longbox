import { page } from 'vite-plus/test/browser';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import ComicSearchPanel from './ComicSearchPanel.svelte';
import { ComicSearchState } from './comic-search-state.svelte';

function renderSearch(search: ComicSearchState, props = {}) {
	return render(ComicSearchPanel, {
		addError: null,
		addingIssueIds: [],
		isInCollection: () => false,
		onAddIssue: vi.fn(),
		open: true,
		resultLimit: 12,
		search,
		...props
	});
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json' },
		status
	});
}

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('ComicSearchPanel', () => {
	it('automatically searches and renders the response', async () => {
		vi.useFakeTimers();
		let resolveResponse!: (response: Response) => void;
		const response = new Promise<Response>((resolve) => {
			resolveResponse = resolve;
		});
		const fetchMock = vi.fn().mockReturnValue(response);
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();
		renderSearch(search);

		await expect.element(page.getByText(/Type at least 2 characters/)).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Search' })).not.toBeInTheDocument();
		await page.getByLabelText('Search comics').fill('man');
		await vi.advanceTimersByTimeAsync(400);
		await expect
			.element(page.getByRole('status'))
			.toHaveTextContent('Searching ComicVine for “man”');

		resolveResponse(
			jsonResponse({
				results: [
					{
						id: 286879,
						name: 'In Storybook Endings',
						issueNumber: '713',
						coverDate: '2011-10-01',
						coverImageUrl: null,
						volume: { id: 796, name: 'Batman' },
						siteDetailUrl: null
					}
				]
			})
		);

		await expect
			.element(page.getByRole('heading', { name: 'Batman #713: In Storybook Endings' }))
			.toBeInTheDocument();
		expect(fetchMock).toHaveBeenCalledWith('/api/comicvine/search?q=man', {
			cache: 'no-store',
			signal: expect.any(AbortSignal)
		});
	});
});
