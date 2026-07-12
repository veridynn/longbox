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
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('ComicSearchState', () => {
	it('debounces and searches only the latest query of at least two characters', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();

		search.setQuery('b');
		await vi.advanceTimersByTimeAsync(400);
		expect(fetchMock).not.toHaveBeenCalled();

		search.setQuery('bat');
		await vi.advanceTimersByTimeAsync(200);
		search.setQuery('  bat   man  ');
		await vi.advanceTimersByTimeAsync(399);
		expect(fetchMock).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(fetchMock).toHaveBeenCalledOnce();
		expect(search.submittedQuery).toBe('bat man');
		expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/comicvine/search?q=bat%20man');
	});

	it('aborts the previous request and ignores its stale response', async () => {
		const first = deferred<Response>();
		const second = deferred<Response>();
		const fetchMock = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();

		search.query = 'batman';
		const firstSearch = search.search();
		const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;
		search.query = 'superman';
		const secondSearch = search.search();

		expect(firstSignal.aborted).toBe(true);
		first.resolve(jsonResponse({ results: [{ id: 1 }] }));
		await firstSearch;
		expect(search.isSearching).toBe(true);

		second.resolve(jsonResponse({ results: [{ id: 2 }] }));
		await secondSearch;
		expect(search.results).toEqual([{ id: 2 }]);
		expect(search.isSearching).toBe(false);
	});

	it('shows an actionable rate-limit error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));
		const search = new ComicSearchState();
		search.query = 'man';

		await search.search();

		expect(search.error).toBe('ComicVine is temporarily rate limiting searches. Try again later.');
		expect(search.results).toEqual([]);
	});

	it('reset cancels a pending debounced search', async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);
		const search = new ComicSearchState();

		search.setQuery('batman');
		search.reset();
		await vi.advanceTimersByTimeAsync(400);

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
