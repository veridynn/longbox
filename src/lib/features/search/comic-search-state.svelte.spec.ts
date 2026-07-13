import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComicSearchState } from './comic-search-state.svelte';

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		headers: { 'content-type': 'application/json' },
		status
	});
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => (resolve = resolvePromise));
	return { promise, resolve };
}

const volume = {
	id: 2,
	name: 'Batman',
	startYear: '2016',
	issueCount: 85,
	coverImageUrl: null,
	publisher: { id: 10, name: 'DC Comics' }
};

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('ComicSearchState', () => {
	it('commits a volume tag and leaves every run collapsed', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ mode: 'volumes', hasMore: false, results: [volume] }));
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();

		search.setDraft('  Bat   man  ');
		await search.commitDraft();

		expect(search.tags).toEqual([{ type: 'volume', value: 'Bat man', label: 'Bat man' }]);
		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/comicvine/search?title=Bat+man&sort=issue-asc');
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(search.openVolumeIds).toEqual([]);
	});

	it('combines character tags with AND semantics and reruns when one is removed', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(jsonResponse({ mode: 'volumes', hasMore: false, results: [] }));
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();

		await search.addSuggestion({
			id: 1,
			type: 'character',
			label: 'Batman',
			subtitle: 'DC Comics'
		});
		await search.addSuggestion({
			id: 2,
			type: 'character',
			label: 'Batwing',
			subtitle: 'DC Comics'
		});

		expect(fetchMock.mock.calls[1]?.[0]).toBe(
			'/api/comicvine/search?characterId=1&characterId=2&sort=issue-asc'
		);
		await search.removeTag(search.characterTags[0]);
		expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/comicvine/search?characterId=2&sort=issue-asc');
	});

	it('does not search with publisher and issue refinements alone', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();

		await search.addSuggestion({ id: 10, type: 'publisher', label: 'DC Comics', subtitle: null });
		search.setFilterType('issue');
		search.setDraft('#1/2');
		await search.commitDraft();

		expect(search.tags).toHaveLength(2);
		expect(search.issueTag?.value).toBe('1/2');
		expect(search.hasSearched).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('parses slash commands and debounces remote suggestions', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn().mockResolvedValue(
			jsonResponse({
				mode: 'suggestions',
				hasMore: false,
				results: [{ id: 1, type: 'character', label: 'Batman', subtitle: 'DC Comics' }]
			})
		);
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();

		search.setDraft('/character Batman');
		expect(search.filterType).toBe('character');
		expect(search.draft).toBe('Batman');
		await vi.advanceTimersByTimeAsync(300);

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/comicvine/search?suggest=character&q=Batman',
			expect.objectContaining({ cache: 'no-store' })
		);
		await vi.waitFor(() => expect(search.suggestions[0]?.label).toBe('Batman'));
	});

	it('resolves and searches a character when Enter is pressed before autocomplete loads', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					mode: 'suggestions',
					hasMore: false,
					results: [{ id: 1, type: 'character', label: 'Batman', subtitle: 'DC Comics' }]
				})
			)
			.mockResolvedValueOnce(jsonResponse({ mode: 'volumes', hasMore: false, results: [] }));
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();
		search.setFilterType('character');
		search.setDraft('Batman');

		await search.commitDraft();

		expect(search.characterTags[0]?.label).toBe('Batman');
		expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/comicvine/search?characterId=1&sort=issue-asc');
	});

	it('aborts stale searches', async () => {
		const first = deferred<Response>();
		const second = deferred<Response>();
		const fetchMock = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();
		search.tags = [{ type: 'volume', value: 'Batman', label: 'Batman' }];

		const firstSearch = search.search();
		const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
		search.tags = [{ type: 'volume', value: 'Superman', label: 'Superman' }];
		const secondSearch = search.search();

		expect(firstSignal.aborted).toBe(true);
		first.resolve(jsonResponse({ mode: 'volumes', results: [], hasMore: false }));
		await firstSearch;
		second.resolve(jsonResponse({ mode: 'volumes', results: [], hasMore: false }));
		await secondSearch;
		expect(search.isSearching).toBe(false);
	});

	it('reuses an already-loaded accordion and loads another run on demand', async () => {
		const older = { ...volume, id: 1, startYear: '1940' };
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ mode: 'volumes', hasMore: false, results: [volume, older] })
			)
			.mockResolvedValue(jsonResponse({ mode: 'issues', hasMore: false, results: [] }));
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();
		search.tags = [{ type: 'volume', value: 'Batman', label: 'Batman' }];

		await search.search();
		await search.toggleVolume(volume, true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await search.toggleVolume(volume, false);
		await search.toggleVolume(volume, true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		await search.toggleVolume(older, true);
		expect(
			new URL(fetchMock.mock.calls[2]?.[0], 'http://localhost').searchParams.get('volumeId')
		).toBe('1');
	});

	it('loads every issue in a volume without applying active search tags', async () => {
		const firstIssue = {
			id: 1,
			name: null,
			issueNumber: '1',
			coverDate: null,
			coverImageUrl: null,
			siteDetailUrl: null,
			volume
		};
		const secondIssue = { ...firstIssue, id: 2, issueNumber: '2' };
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ mode: 'issues', hasMore: true, nextOffset: 50, results: [firstIssue] })
			)
			.mockResolvedValueOnce(
				jsonResponse({ mode: 'issues', hasMore: false, results: [secondIssue] })
			);
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();
		search.tags = [{ type: 'character', id: 1, label: 'Batman' }];

		await expect(search.allIssuesForVolume(volume)).resolves.toEqual([firstIssue, secondIssue]);
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'/api/comicvine/search?volumeId=2&sort=issue-asc&offset=0',
			'/api/comicvine/search?volumeId=2&sort=issue-asc&offset=50'
		]);
	});

	it('shows an actionable rate-limit error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));
		const search = new ComicSearchState();
		search.tags = [{ type: 'volume', value: 'Batman', label: 'Batman' }];

		await search.search();
		expect(search.error).toBe('ComicVine is temporarily rate limiting searches. Try again later.');
	});
});
