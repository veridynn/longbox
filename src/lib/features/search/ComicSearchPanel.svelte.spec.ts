import { page, userEvent } from 'vite-plus/test/browser';
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
		search,
		...props
	});
}

function jsonResponse(body: unknown) {
	return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}

const volumes = [
	{
		id: 2,
		name: 'Batman',
		startYear: '2016',
		issueCount: 85,
		coverImageUrl: null,
		publisher: { id: 10, name: 'DC Comics' }
	},
	{
		id: 1,
		name: 'Batman',
		startYear: '1940',
		issueCount: 715,
		coverImageUrl: null,
		publisher: { id: 10, name: 'DC Comics' }
	}
];

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('ComicSearchPanel', () => {
	it('shows actionable initial and zero-result empty states', async () => {
		const search = new ComicSearchState();
		renderSearch(search);

		await expect.element(page.getByRole('heading', { name: 'Search comics' })).toBeInTheDocument();

		search.tags = [{ type: 'volume', value: 'Batman', label: 'Batman' }];
		search.hasSearched = true;

		await expect
			.element(page.getByRole('heading', { name: 'No matching runs found' }))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Clear search' }).click();

		expect(search.tags).toEqual([]);
		await expect.element(page.getByRole('heading', { name: 'Search comics' })).toBeInTheDocument();
	});

	it('retries a failed search through its existing search action', async () => {
		const search = new ComicSearchState();
		search.tags = [{ type: 'volume', value: 'Batman', label: 'Batman' }];
		search.hasSearched = true;
		search.error = 'Unable to search. Try again.';
		const retry = vi.spyOn(search, 'search').mockResolvedValue();
		renderSearch(search);

		await expect.element(page.getByRole('alert')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Retry' }).click();

		expect(retry).toHaveBeenCalledOnce();
	});

	it('supports slash commands and commits resolved character tags', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(jsonResponse({ mode: 'volumes', hasMore: false, results: [] }));
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();
		renderSearch(search);
		await expect.element(page.getByLabelText('Find comics')).toHaveFocus();
		await expect.element(page.getByRole('button', { name: 'Search' })).toBeInTheDocument();
		await expect.element(page.getByPlaceholder('Search by volume')).toBeInTheDocument();
		await expect.element(page.getByText('Type / for search commands')).toBeInTheDocument();
		await expect.element(page.getByText('Sort issues')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Hide owned' })).not.toBeInTheDocument();

		await page.getByLabelText('Find comics').fill('/');
		await expect
			.element(page.getByRole('option', { name: '/character Character' }))
			.toBeInTheDocument();
		await page.getByRole('option', { name: '/character Character' }).click();
		await expect.element(page.getByPlaceholder('Search by character')).toBeInTheDocument();
		await page.getByLabelText('Find comics').fill('Batman');
		search.suggestions = [{ id: 1, type: 'character', label: 'Batman', subtitle: 'DC Comics' }];
		await page.getByRole('option', { name: 'Batman DC Comics' }).click();

		await expect.element(page.getByText('Character: Batman')).toBeInTheDocument();
		expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
			'/api/comicvine/search?characterId=1&sort=issue-asc'
		);
	});

	it('shows runs collapsed and lazy-loads them', async () => {
		const issue = {
			id: 423,
			name: 'You Shoulda Seen Him',
			issueNumber: '423',
			coverDate: '1988-09-01',
			coverImageUrl: null,
			siteDetailUrl: null,
			volume: volumes[0]
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ mode: 'volumes', hasMore: false, results: volumes }))
			.mockResolvedValueOnce(jsonResponse({ mode: 'issues', hasMore: false, results: [issue] }))
			.mockResolvedValueOnce(jsonResponse({ mode: 'issues', hasMore: false, results: [] }));
		vi.stubGlobal('fetch', fetchMock);
		renderSearch(new ComicSearchState(), {
			isInCollection: (candidate: { id: number }) => candidate.id === 423
		});

		const input = page.getByLabelText('Find comics');
		await input.fill('Batman');
		await input.click();
		await userEvent.keyboard('{Enter}');

		await expect.element(page.getByText('Volume: Batman')).toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'Batman (2016)', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'Batman (1940)', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('heading', { name: 'Batman (2016) #423: You Shoulda Seen Him' }))
			.not.toBeInTheDocument();
		expect(fetchMock).toHaveBeenCalledOnce();

		await page.getByRole('heading', { name: 'Batman (2016)', exact: true }).click();
		await expect
			.element(page.getByRole('heading', { name: 'Batman (2016) #423: You Shoulda Seen Him' }))
			.toBeInTheDocument();

		await page.getByRole('heading', { name: 'Batman (1940)', exact: true }).click();
		await expect.poll(() => fetchMock.mock.calls.length).toBe(3);
		expect(
			new URL(fetchMock.mock.calls[2]?.[0], 'http://localhost').searchParams.get('volumeId')
		).toBe('1');
	});

	it('adds every issue in a selected volume', async () => {
		const issue = {
			id: 1,
			name: null,
			issueNumber: '1',
			coverDate: null,
			coverImageUrl: null,
			siteDetailUrl: null,
			volume: volumes[0]
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ mode: 'volumes', hasMore: false, results: [volumes[0]] })
			)
			.mockResolvedValueOnce(jsonResponse({ mode: 'issues', hasMore: false, results: [] }))
			.mockResolvedValueOnce(jsonResponse({ mode: 'issues', hasMore: false, results: [issue] }));
		vi.stubGlobal('fetch', fetchMock);
		const onAddIssue = vi.fn().mockResolvedValue(true);
		renderSearch(new ComicSearchState(), { onAddIssue });

		const input = page.getByLabelText('Find comics');
		await input.fill('Batman');
		await input.click();
		await userEvent.keyboard('{Enter}');
		await page.getByRole('heading', { name: 'Batman (2016)', exact: true }).click();
		await page.getByRole('button', { name: 'Add whole volume' }).click();

		await expect.poll(() => onAddIssue.mock.calls.length).toBe(1);
		expect(onAddIssue).toHaveBeenCalledWith(issue);
	});
});
