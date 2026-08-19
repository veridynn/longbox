import type {
	ComicSearchResponse,
	SearchIssue,
	SearchSuggestion,
	SearchVolume
} from '$lib/comics/types';

type SearchResponse = ComicSearchResponse | { error?: string };

export type SearchTag =
	| { type: 'volume'; value: string; label: string }
	| { type: 'issue'; value: string; label: string }
	| { type: 'character'; id: number; label: string; subtitle?: string | null }
	| { type: 'publisher'; id: number; label: string; subtitle?: string | null };
export type SearchTagType = SearchTag['type'];

export const SEARCH_COMMANDS: Array<{ type: SearchTagType; label: string; command: string }> = [
	{ type: 'volume', label: 'Volume', command: '/volume' },
	{ type: 'character', label: 'Character', command: '/character' },
	{ type: 'publisher', label: 'Publisher', command: '/publisher' },
	{ type: 'issue', label: 'Issue', command: '/issue' }
];

export type VolumeIssueState = {
	issues: SearchIssue[];
	hasMore: boolean;
	nextOffset: number;
	isLoading: boolean;
	loaded: boolean;
	error: string | null;
};

function normalizeText(value: string) {
	return value.trim().replace(/\s+/g, ' ');
}

async function readSearchResponse(response: Response): Promise<SearchResponse | null> {
	try {
		return (await response.json()) as SearchResponse;
	} catch {
		return null;
	}
}

function responseError(response: Response) {
	if (response.status === 429) {
		return 'Search is temporarily unavailable. Try again later.';
	}
	return 'Unable to search. Try again.';
}

function tagKey(tag: SearchTag) {
	return tag.type === 'character' || tag.type === 'publisher'
		? `${tag.type}:${tag.id}`
		: `${tag.type}:${tag.value.toLocaleLowerCase()}`;
}

function emptyVolumeState(): VolumeIssueState {
	return {
		issues: [],
		hasMore: false,
		nextOffset: 0,
		isLoading: false,
		loaded: false,
		error: null
	};
}

export class ComicSearchState {
	filterType = $state<SearchTagType>('volume');
	draft = $state('');
	tags = $state<SearchTag[]>([]);
	suggestions = $state<SearchSuggestion[]>([]);
	isSuggesting = $state(false);
	suggestionError = $state<string | null>(null);
	inputError = $state<string | null>(null);
	volumes = $state<SearchVolume[]>([]);
	volumeIssues = $state<Record<number, VolumeIssueState>>({});
	openVolumeIds = $state<number[]>([]);
	mode = $state<'volumes' | 'issues'>('volumes');
	error = $state<string | null>(null);
	isSearching = $state(false);
	hasSearched = $state(false);
	hasMore = $state(false);
	nextOffset = $state(0);

	#searchController: AbortController | null = null;
	#suggestController: AbortController | null = null;
	#volumeControllers = new Map<number, AbortController>();
	#suggestTimer: ReturnType<typeof setTimeout> | null = null;
	#requestId = 0;
	#suggestRequestId = 0;

	get volumeTag() {
		return (
			this.tags.find(
				(tag): tag is Extract<SearchTag, { type: 'volume' }> => tag.type === 'volume'
			) ?? null
		);
	}

	get issueTag() {
		return (
			this.tags.find((tag): tag is Extract<SearchTag, { type: 'issue' }> => tag.type === 'issue') ??
			null
		);
	}

	get publisherTag() {
		return (
			this.tags.find(
				(tag): tag is Extract<SearchTag, { type: 'publisher' }> => tag.type === 'publisher'
			) ?? null
		);
	}

	get characterTags() {
		return this.tags.filter(
			(tag): tag is Extract<SearchTag, { type: 'character' }> => tag.type === 'character'
		);
	}

	get hasAnchor() {
		return Boolean(this.volumeTag || this.characterTags.length);
	}

	setFilterType(type: SearchTagType) {
		this.filterType = type;
		this.draft = '';
		this.inputError = null;
		this.#cancelSuggestions();
	}

	setDraft(value: string) {
		const command = value.match(/^\/(volume|character|publisher|issue)(?:\s+(.*))?$/i);
		if (command) {
			this.filterType = command[1].toLocaleLowerCase() as SearchTagType;
			this.draft = command[2] ?? '';
		} else {
			this.draft = value;
		}
		this.inputError = null;
		this.#scheduleSuggestions();
	}

	selectCommand(type: SearchTagType) {
		this.setFilterType(type);
	}

	async commitDraft() {
		let value = normalizeText(this.draft);
		if (this.filterType === 'issue') value = value.replace(/^#/, '');
		if (this.filterType === 'volume' && value.length < 2) {
			this.inputError = 'Enter at least 2 characters for a volume.';
			return;
		}
		if (!value) {
			this.inputError = `Enter an ${this.filterType === 'issue' ? 'issue number' : this.filterType}.`;
			return;
		}
		if (this.filterType === 'character' || this.filterType === 'publisher') {
			if (value.length < 2) {
				this.inputError = `Enter at least 2 characters for a ${this.filterType}.`;
				return;
			}
			let suggestion = this.#preferredSuggestion(value);
			if (!suggestion) {
				await this.fetchSuggestions();
				suggestion = this.#preferredSuggestion(value);
			}
			if (suggestion) await this.addSuggestion(suggestion);
			else this.inputError = `No matching ${this.filterType} found.`;
			return;
		}

		const tag: SearchTag = { type: this.filterType, value, label: value };
		if (!this.#addTag(tag)) return;
		this.#finishTag();
		await this.search();
	}

	async addSuggestion(suggestion: SearchSuggestion) {
		const tag: SearchTag = {
			type: suggestion.type,
			id: suggestion.id,
			label: suggestion.label,
			subtitle: suggestion.subtitle
		};
		if (!this.#addTag(tag)) return;
		this.#finishTag();
		await this.search();
	}

	async removeTag(tag: SearchTag) {
		const key = tagKey(tag);
		this.tags = this.tags.filter((candidate) => tagKey(candidate) !== key);
		this.inputError = null;
		if (this.hasAnchor) await this.search();
		else this.#clearResults(this.tags.length > 0);
	}

	async search(options: { append?: boolean } = {}) {
		if (!this.hasAnchor) {
			this.#clearResults(this.tags.length > 0);
			return;
		}

		const append = options.append === true;
		const requestId = ++this.#requestId;
		this.#searchController?.abort();
		if (!append) {
			for (const controller of this.#volumeControllers.values()) controller.abort();
			this.#volumeControllers.clear();
			this.volumes = [];
			this.volumeIssues = {};
			this.openVolumeIds = [];
			this.nextOffset = 0;
		}
		const controller = new AbortController();
		this.#searchController = controller;
		this.error = null;
		this.isSearching = true;
		this.hasSearched = true;

		const params = this.#searchParams();
		if (append && this.nextOffset) params.set('offset', String(this.nextOffset));

		try {
			const response = await fetch(`/api/comicvine/search?${params}`, {
				cache: 'no-store',
				signal: controller.signal
			});
			const body = await readSearchResponse(response);
			if (requestId !== this.#requestId || controller.signal.aborted) return;
			if (!response.ok) {
				this.error = responseError(response);
				return;
			}
			if (!body || !('mode' in body) || body.mode === 'suggestions') {
				this.error = 'Search returned an invalid response. Try again.';
				return;
			}

			this.mode = body.mode;
			this.hasMore = body.hasMore;
			this.nextOffset = body.nextOffset ?? 0;
			if (body.mode === 'volumes') {
				this.volumes = append ? this.#mergeVolumes(this.volumes, body.results) : body.results;
				if (!append) this.openVolumeIds = [];
			} else {
				this.#storeIssueResults(body.results, append);
			}
		} catch {
			if (requestId === this.#requestId && !controller.signal.aborted) {
				this.error = 'Unable to search. Try again.';
			}
		} finally {
			if (requestId === this.#requestId) {
				this.#searchController = null;
				this.isSearching = false;
			}
		}
	}

	async toggleVolume(volume: SearchVolume, open: boolean) {
		if (open) {
			if (!this.openVolumeIds.includes(volume.id)) {
				this.openVolumeIds = [...this.openVolumeIds, volume.id];
			}
			await this.loadVolume(volume);
		} else {
			this.openVolumeIds = this.openVolumeIds.filter((id) => id !== volume.id);
		}
	}

	async loadVolume(volume: SearchVolume, options: { append?: boolean } = {}) {
		const append = options.append === true;
		const existing = this.volumeIssues[volume.id] ?? emptyVolumeState();
		if (existing.isLoading) return;
		if (!append && existing.loaded) return;
		const controller = new AbortController();
		this.#volumeControllers.get(volume.id)?.abort();
		this.#volumeControllers.set(volume.id, controller);
		this.volumeIssues = {
			...this.volumeIssues,
			[volume.id]: { ...existing, isLoading: true, error: null }
		};

		const params = this.#searchParams();
		params.delete('title');
		params.set('volumeId', String(volume.id));
		if (append && existing.nextOffset) params.set('offset', String(existing.nextOffset));

		try {
			const response = await fetch(`/api/comicvine/search?${params}`, {
				cache: 'no-store',
				signal: controller.signal
			});
			const body = await readSearchResponse(response);
			if (controller.signal.aborted) return;
			if (!response.ok || !body || !('mode' in body) || body.mode !== 'issues') {
				this.volumeIssues = {
					...this.volumeIssues,
					[volume.id]: {
						...existing,
						isLoading: false,
						error: responseError(response)
					}
				};
				return;
			}
			const issues = append ? this.#mergeIssues(existing.issues, body.results) : body.results;
			this.volumeIssues = {
				...this.volumeIssues,
				[volume.id]: {
					issues,
					hasMore: body.hasMore,
					nextOffset: body.nextOffset ?? 0,
					isLoading: false,
					loaded: true,
					error: null
				}
			};
		} catch {
			if (!controller.signal.aborted) {
				this.volumeIssues = {
					...this.volumeIssues,
					[volume.id]: {
						...existing,
						isLoading: false,
						error: 'Unable to load issues. Try again.'
					}
				};
			}
		} finally {
			if (this.#volumeControllers.get(volume.id) === controller) {
				this.#volumeControllers.delete(volume.id);
			}
		}
	}

	async allIssuesForVolume(volume: SearchVolume) {
		let issues: SearchIssue[] = [];
		let offset = 0;

		while (true) {
			const params = new URLSearchParams({
				volumeId: String(volume.id),
				sort: 'issue-asc',
				offset: String(offset)
			});
			const response = await fetch(`/api/comicvine/search?${params}`, { cache: 'no-store' });
			const body = await readSearchResponse(response);
			if (!response.ok || !body || !('mode' in body) || body.mode !== 'issues') {
				throw new Error(responseError(response));
			}

			issues = this.#mergeIssues(issues, body.results);
			if (!body.hasMore) return issues;
			if (!body.nextOffset || body.nextOffset <= offset) {
				throw new Error('Search returned invalid volume pagination.');
			}
			offset = body.nextOffset;
		}
	}

	reset() {
		this.#cancelAll();
		this.filterType = 'volume';
		this.draft = '';
		this.tags = [];
		this.suggestions = [];
		this.isSuggesting = false;
		this.suggestionError = null;
		this.inputError = null;
		this.#clearResults(false);
	}

	#addTag(tag: SearchTag) {
		const key = tagKey(tag);
		if (this.tags.some((candidate) => tagKey(candidate) === key)) {
			this.#finishTag();
			return false;
		}
		if (tag.type === 'character') {
			if (this.characterTags.length >= 10) {
				this.inputError = 'Use no more than 10 character searches.';
				return false;
			}
			this.tags = [...this.tags, tag];
		} else {
			this.tags = [...this.tags.filter((candidate) => candidate.type !== tag.type), tag];
		}
		return true;
	}

	#finishTag() {
		this.draft = '';
		this.inputError = null;
		this.#cancelSuggestions();
	}

	#searchParams() {
		const params = new URLSearchParams();
		if (this.volumeTag) params.set('title', this.volumeTag.value);
		if (this.issueTag) params.set('issue', this.issueTag.value);
		if (this.publisherTag) params.set('publisherId', String(this.publisherTag.id));
		for (const character of this.characterTags) {
			params.append('characterId', String(character.id));
		}
		params.set('sort', 'issue-asc');
		return params;
	}

	#storeIssueResults(results: SearchIssue[], append: boolean) {
		const volumes = this.#mergeVolumes(
			append ? this.volumes : [],
			results.map((result) => result.volume)
		);
		const next = append ? { ...this.volumeIssues } : {};
		for (const volume of volumes) {
			const issues = results.filter((issue) => issue.volume.id === volume.id);
			if (!issues.length && !next[volume.id]) continue;
			const existing = next[volume.id] ?? emptyVolumeState();
			next[volume.id] = {
				...existing,
				issues: append ? this.#mergeIssues(existing.issues, issues) : issues,
				loaded: true,
				isLoading: false
			};
		}
		this.volumes = volumes;
		this.volumeIssues = next;
		if (!append) this.openVolumeIds = [];
	}

	#mergeVolumes(first: SearchVolume[], second: SearchVolume[]) {
		return [...new Map([...first, ...second].map((volume) => [volume.id, volume])).values()];
	}

	#mergeIssues(first: SearchIssue[], second: SearchIssue[]) {
		return [...new Map([...first, ...second].map((issue) => [issue.id, issue])).values()];
	}

	#scheduleSuggestions() {
		this.#cancelSuggestions();
		const query = normalizeText(this.draft);
		if (
			(this.filterType !== 'character' && this.filterType !== 'publisher') ||
			query.length < 2 ||
			query.startsWith('/')
		) {
			return;
		}
		this.#suggestTimer = setTimeout(() => void this.fetchSuggestions(), 300);
	}

	async fetchSuggestions() {
		if (this.#suggestTimer) clearTimeout(this.#suggestTimer);
		this.#suggestTimer = null;
		const query = normalizeText(this.draft);
		if ((this.filterType !== 'character' && this.filterType !== 'publisher') || query.length < 2) {
			return;
		}
		const requestId = ++this.#suggestRequestId;
		this.#suggestController?.abort();
		const controller = new AbortController();
		this.#suggestController = controller;
		this.isSuggesting = true;
		this.suggestionError = null;
		try {
			const params = new URLSearchParams({ suggest: this.filterType, q: query });
			const response = await fetch(`/api/comicvine/search?${params}`, {
				cache: 'no-store',
				signal: controller.signal
			});
			const body = await readSearchResponse(response);
			if (requestId !== this.#suggestRequestId || controller.signal.aborted) return;
			if (!response.ok || !body || !('mode' in body) || body.mode !== 'suggestions') {
				this.suggestionError = responseError(response);
				return;
			}
			this.suggestions = body.results;
		} catch {
			if (requestId === this.#suggestRequestId && !controller.signal.aborted) {
				this.suggestionError = 'Unable to load suggestions.';
			}
		} finally {
			if (requestId === this.#suggestRequestId) {
				this.#suggestController = null;
				this.isSuggesting = false;
			}
		}
	}

	#preferredSuggestion(value: string) {
		const normalized = value.toLocaleLowerCase();
		return (
			this.suggestions.find((suggestion) => suggestion.label.toLocaleLowerCase() === normalized) ??
			this.suggestions[0]
		);
	}

	#cancelSuggestions() {
		this.#suggestRequestId += 1;
		if (this.#suggestTimer) clearTimeout(this.#suggestTimer);
		this.#suggestTimer = null;
		this.#suggestController?.abort();
		this.#suggestController = null;
		this.suggestions = [];
		this.isSuggesting = false;
		this.suggestionError = null;
	}

	#cancelAll() {
		this.#requestId += 1;
		this.#searchController?.abort();
		this.#searchController = null;
		for (const controller of this.#volumeControllers.values()) controller.abort();
		this.#volumeControllers.clear();
		this.#cancelSuggestions();
		this.isSearching = false;
	}

	#clearResults(hasSearched: boolean) {
		this.#requestId += 1;
		this.#searchController?.abort();
		this.#searchController = null;
		for (const controller of this.#volumeControllers.values()) controller.abort();
		this.#volumeControllers.clear();
		this.volumes = [];
		this.volumeIssues = {};
		this.openVolumeIds = [];
		this.mode = 'volumes';
		this.error = null;
		this.isSearching = false;
		this.hasSearched = hasSearched;
		this.hasMore = false;
		this.nextOffset = 0;
	}
}
