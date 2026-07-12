import type { SearchIssue } from '$lib/comics/types';

type SearchResponse = {
	error?: string;
	results?: SearchIssue[];
};

const SEARCH_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 2;

function normalizeQuery(query: string) {
	return query.trim().replace(/\s+/g, ' ');
}

async function readSearchResponse(response: Response): Promise<SearchResponse | null> {
	try {
		return (await response.json()) as SearchResponse;
	} catch {
		return null;
	}
}

function responseError(response: Response, body: SearchResponse | null) {
	if (body?.error) return body.error;
	if (response.status === 429) {
		return 'ComicVine is temporarily rate limiting searches. Try again later.';
	}
	return 'Unable to search ComicVine. Try again.';
}

export class ComicSearchState {
	query = $state('');
	results = $state<SearchIssue[]>([]);
	error = $state<string | null>(null);
	isSearching = $state(false);
	hasSearched = $state(false);
	submittedQuery = $state('');

	#controller: AbortController | null = null;
	#debounce: ReturnType<typeof setTimeout> | null = null;
	#requestId = 0;

	#applyResponse(requestId: number, response: Response, body: SearchResponse | null) {
		if (requestId !== this.#requestId) return;
		if (!response.ok) {
			this.error = responseError(response, body);
			return;
		}
		if (!Array.isArray(body?.results)) {
			this.error = 'ComicVine returned an invalid response. Try again.';
			return;
		}
		this.results = body.results;
	}

	#finish(requestId: number) {
		if (requestId !== this.#requestId) return;
		this.#controller = null;
		this.isSearching = false;
	}

	#isCurrent(requestId: number, controller: AbortController) {
		return requestId === this.#requestId && !controller.signal.aborted;
	}

	setQuery(query: string) {
		this.query = query;
		if (this.#debounce) clearTimeout(this.#debounce);
		this.#debounce = null;
		this.#requestId += 1;
		this.#controller?.abort();
		this.#controller = null;
		this.results = [];
		this.error = null;
		this.isSearching = false;
		this.hasSearched = false;
		this.submittedQuery = '';

		if (normalizeQuery(query).length < MIN_QUERY_LENGTH) return;
		this.#debounce = setTimeout(() => {
			this.#debounce = null;
			void this.search();
		}, SEARCH_DEBOUNCE_MS);
	}

	async search() {
		if (this.#debounce) clearTimeout(this.#debounce);
		this.#debounce = null;
		const query = normalizeQuery(this.query);
		const requestId = ++this.#requestId;

		this.#controller?.abort();
		this.#controller = null;
		this.query = query;
		this.submittedQuery = query;
		this.results = [];
		this.error = null;

		if (query.length < MIN_QUERY_LENGTH) {
			this.isSearching = false;
			return;
		}
		this.hasSearched = true;

		const controller = new AbortController();
		this.#controller = controller;
		this.isSearching = true;

		try {
			const response = await fetch(`/api/comicvine/search?q=${encodeURIComponent(query)}`, {
				cache: 'no-store',
				signal: controller.signal
			});
			const body = await readSearchResponse(response);
			this.#applyResponse(requestId, response, body);
		} catch {
			if (this.#isCurrent(requestId, controller)) {
				this.error = 'Unable to search ComicVine. Try again.';
			}
		} finally {
			this.#finish(requestId);
		}
	}

	reset() {
		if (this.#debounce) clearTimeout(this.#debounce);
		this.#debounce = null;
		this.#requestId += 1;
		this.#controller?.abort();
		this.#controller = null;
		this.query = '';
		this.results = [];
		this.error = null;
		this.isSearching = false;
		this.hasSearched = false;
		this.submittedQuery = '';
	}
}
