import { env } from '$env/dynamic/private';
import { getCache } from '@vercel/functions';
import type {
	ComicSearchResponse,
	SearchIssue,
	SearchSuggestion,
	SearchVolume
} from '$lib/comics/types';

const COMIC_VINE_BASE_URL = 'https://comicvine.gamespot.com/api';
const SEARCH_RESULT_TTL_MS = 5 * 60 * 1000;
const MAX_MEMORY_CACHE_ENTRIES = 100;
const MAX_CONCURRENT_REQUESTS = 3;
const SEARCH_PAGE_SIZE = 20;
const ISSUE_PAGE_SIZE = 50;
const COMIC_VINE_TIMEOUT_MS = 12_000;
const DEFAULT_COOLDOWN_SECONDS = 60;
const RUNTIME_CACHE_NAMESPACE = 'longbox-comicvine-v5';
const CREDIT_BATCH_SIZE = 50;
const CHARACTER_ISSUE_PAGE_SIZE = 50;
const DC_PUBLISHERS = new Set([
	'all-american publications',
	'black label',
	'dc black label',
	'dc comics',
	'dc comics - vertigo',
	'dc comics/wildstorm',
	'dc young animal',
	'elseworlds',
	'milestone media',
	'national comics publications',
	'national periodical publications',
	'vertigo',
	'wildstorm',
	'young animal'
]);

type ComicVineImage = {
	icon_url?: string | null;
	medium_url?: string | null;
	screen_url?: string | null;
	small_url?: string | null;
	super_url?: string | null;
	thumb_url?: string | null;
	tiny_url?: string | null;
};

type ComicVineReference = {
	id?: number | string | null;
	name?: string | null;
	api_detail_url?: string | null;
	site_detail_url?: string | null;
	image?: ComicVineImage | null;
	role?: string | null;
	roles?: string | string[] | null;
};

export type ComicVineSearchIssue = SearchIssue;

export type ComicVineIssueDetail = {
	id: number;
	name: string | null;
	issueNumber: string;
	coverDate: string | null;
	storeDate: string | null;
	coverImageUrl: string | null;
	descriptionHtml: string | null;
	summary: string | null;
	volume: {
		id: number | null;
		name: string | null;
	};
	characters: Array<{
		id: number;
		name: string;
		imageUrl: string | null;
	}>;
	credits: Array<{
		id: number;
		name: string;
		roles: string[];
	}>;
	raw: unknown;
};

export type ComicVineVolumeDetail = {
	id: number;
	name: string;
	startYear: string | null;
	status: string | null;
	summary: string | null;
	issueCount: number | null;
	coverImageUrl: string | null;
	publisher: {
		id: number;
		name: string;
	} | null;
	raw: unknown;
};

type ComicVineResponse<T> = {
	error?: string;
	status_code?: number;
	results?: T;
};

type ComicVineRecord = Record<string, unknown>;

type CacheEntry<T> = { expiresAt: number; value: T };

type CharacterCredits = {
	issueIds: number[];
};

type ComicVineCache = {
	cooldownUntil: number;
	cooldownUpdatePromise?: Promise<void>;
	activeRequests: number;
	requestWaiters: Array<() => void>;
	searchPromises: Map<string, Promise<ComicSearchResponse>>;
	searchResults: Map<string, CacheEntry<ComicSearchResponse>>;
	characterPromises: Map<number, Promise<CharacterCredits>>;
	characterResults: Map<number, CacheEntry<CharacterCredits>>;
};

const comicVineCache: ComicVineCache = ((
	globalThis as typeof globalThis & { __longboxComicVineCacheV5?: ComicVineCache }
).__longboxComicVineCacheV5 ??= {
	cooldownUntil: 0,
	activeRequests: 0,
	requestWaiters: [],
	searchPromises: new Map(),
	searchResults: new Map(),
	characterPromises: new Map(),
	characterResults: new Map()
});

comicVineCache.cooldownUntil ??= 0;
comicVineCache.activeRequests ??= 0;
comicVineCache.requestWaiters ??= [];
comicVineCache.searchPromises ??= new Map();
comicVineCache.searchResults ??= new Map();
comicVineCache.characterPromises ??= new Map();
comicVineCache.characterResults ??= new Map();

export class ComicVineError extends Error {
	constructor(
		message: string,
		readonly status = 502,
		readonly retryAfterSeconds?: number
	) {
		super(message);
	}
}

function apiKey() {
	if (!env.COMIC_VINE_API_KEY) {
		throw new ComicVineError('COMIC_VINE_API_KEY is not configured.', 500);
	}

	return env.COMIC_VINE_API_KEY;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function imageUrl(value: unknown) {
	const image = objectRecord(value) as ComicVineImage | null;
	return image?.medium_url ?? image?.small_url ?? image?.thumb_url ?? image?.icon_url ?? null;
}

function numberId(value: unknown) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function issueNumber(value: unknown) {
	return text(value) ?? '0';
}

function runtimeCache() {
	if (!env.VERCEL) return null;

	try {
		return getCache({ namespace: RUNTIME_CACHE_NAMESPACE });
	} catch {
		return null;
	}
}

async function runtimeCacheGet(key: string) {
	try {
		return (await runtimeCache()?.get(key)) ?? null;
	} catch {
		return null;
	}
}

async function runtimeCacheSet(key: string, value: unknown, ttl: number) {
	try {
		await runtimeCache()?.set(key, value, { ttl });
	} catch {
		// Runtime Cache is an optimization; the bounded process cache remains available.
	}
}

function memoryCacheGet<K, V>(cache: Map<K, CacheEntry<V>>, key: K) {
	const entry = cache.get(key);
	if (!entry) return undefined;
	if (entry.expiresAt > Date.now()) return entry.value;

	cache.delete(key);
	return undefined;
}

function memoryCacheSet<K, V>(cache: Map<K, CacheEntry<V>>, key: K, value: V, ttl: number) {
	cache.delete(key);
	cache.set(key, { expiresAt: Date.now() + ttl, value });

	if (cache.size > MAX_MEMORY_CACHE_ENTRIES) {
		cache.delete(cache.keys().next().value as K);
	}
}

function validSearchVolume(value: unknown) {
	const volume = objectRecord(value);
	return typeof volume?.id === 'number' && typeof volume.name === 'string';
}

function cachedSearchResponse(value: unknown) {
	const response = objectRecord(value);
	if (
		(response?.mode !== 'volumes' &&
			response?.mode !== 'issues' &&
			response?.mode !== 'suggestions') ||
		!Array.isArray(response.results) ||
		typeof response.hasMore !== 'boolean'
	) {
		return null;
	}

	const valid = response.results.every((result) => {
		if (response.mode === 'volumes') return validSearchVolume(result);
		if (response.mode === 'suggestions') {
			const suggestion = objectRecord(result);
			return (
				typeof suggestion?.id === 'number' &&
				typeof suggestion.label === 'string' &&
				(suggestion.type === 'character' || suggestion.type === 'publisher')
			);
		}
		const issue = objectRecord(result);
		return (
			typeof issue?.id === 'number' &&
			typeof issue.issueNumber === 'string' &&
			validSearchVolume(issue.volume)
		);
	});

	return valid ? (value as ComicSearchResponse) : null;
}

function retryAfterSeconds(value: string | null) {
	const seconds = Number(value);
	if (value !== null && Number.isFinite(seconds) && seconds >= 0) {
		return Math.max(1, Math.ceil(seconds));
	}

	const retryAt = value ? Date.parse(value) : Number.NaN;
	if (Number.isFinite(retryAt) && retryAt > Date.now()) {
		return Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
	}

	return DEFAULT_COOLDOWN_SECONDS;
}

async function setCooldown(seconds: number) {
	comicVineCache.cooldownUntil = Math.max(
		comicVineCache.cooldownUntil,
		Date.now() + seconds * 1000
	);
	const previous = comicVineCache.cooldownUpdatePromise;
	const update = (async () => {
		await previous?.catch(() => undefined);
		const cached = await runtimeCacheGet('cooldown');
		const cachedUntil = typeof cached === 'number' && Number.isFinite(cached) ? cached : 0;
		comicVineCache.cooldownUntil = Math.max(comicVineCache.cooldownUntil, cachedUntil);
		const ttl = Math.max(1, Math.ceil((comicVineCache.cooldownUntil - Date.now()) / 1000));
		await runtimeCacheSet('cooldown', comicVineCache.cooldownUntil, ttl);
	})();
	comicVineCache.cooldownUpdatePromise = update;

	try {
		await update;
	} finally {
		if (comicVineCache.cooldownUpdatePromise === update) {
			comicVineCache.cooldownUpdatePromise = undefined;
		}
	}
}

function cooldownError(until: number) {
	const retryAfter = Math.max(1, Math.ceil((until - Date.now()) / 1000));
	return new ComicVineError(
		`ComicVine is temporarily rate limiting requests. Try again in ${retryAfter} seconds.`,
		429,
		retryAfter
	);
}

async function assertNotCoolingDown() {
	if (comicVineCache.cooldownUntil > Date.now()) {
		throw cooldownError(comicVineCache.cooldownUntil);
	}

	const cached = await runtimeCacheGet('cooldown');
	if (typeof cached === 'number' && Number.isFinite(cached) && cached > Date.now()) {
		comicVineCache.cooldownUntil = cached;
		throw cooldownError(cached);
	}
}

function normalizeRef(value: unknown) {
	const ref = objectRecord(value) as ComicVineReference | null;

	return {
		id: numberId(ref?.id),
		name: text(ref?.name)
	};
}

function rolesForCredit(credit: ComicVineReference) {
	const rawRoles = Array.isArray(credit.roles)
		? credit.roles
		: typeof credit.roles === 'string'
			? credit.roles.split(',')
			: typeof credit.role === 'string'
				? credit.role.split(',')
				: [];

	const roles = rawRoles.map((role) => role.trim().toLowerCase()).filter(Boolean);
	return roles.length ? Array.from(new Set(roles)) : ['credit'];
}

function ensureResults<T>(payload: ComicVineResponse<T>) {
	if (payload.status_code && payload.status_code !== 1) {
		throw new ComicVineError(payload.error ?? 'ComicVine returned an error.');
	}

	if (!payload.results) {
		throw new ComicVineError('ComicVine returned no results.');
	}

	return payload.results;
}

async function comicVineGet<T>(path: string, params: Record<string, string | number | undefined>) {
	return withRequestSlot(async () => {
		const signal = AbortSignal.timeout(COMIC_VINE_TIMEOUT_MS);
		const response = await fetchComicVineResponse(comicVineUrl(path, params), signal);

		if (!response.ok) await throwComicVineHttpError(response);
		return readComicVineResults<T>(response, signal);
	});
}

function comicVineUrl(path: string, params: Record<string, string | number | undefined>) {
	const url = new URL(`${COMIC_VINE_BASE_URL}${path}`);
	url.searchParams.set('api_key', apiKey());
	url.searchParams.set('format', 'json');

	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') {
			url.searchParams.set(key, String(value));
		}
	}
	return url;
}

async function withRequestSlot<T>(request: () => Promise<T>) {
	if (comicVineCache.activeRequests >= MAX_CONCURRENT_REQUESTS) {
		await new Promise<void>((resolve) => comicVineCache.requestWaiters.push(resolve));
	} else {
		comicVineCache.activeRequests += 1;
	}

	try {
		return await request();
	} finally {
		const next = comicVineCache.requestWaiters.shift();
		if (next) next();
		else comicVineCache.activeRequests -= 1;
	}
}

function isTimeout(error: unknown, signal: AbortSignal) {
	return signal.aborted || (error instanceof Error && error.name === 'TimeoutError');
}

async function fetchComicVineResponse(url: URL, signal: AbortSignal) {
	try {
		return await fetch(url, {
			headers: {
				accept: 'application/json',
				'user-agent': 'Longbox/0.1 (ComicVine import)'
			},
			signal
		});
	} catch (error) {
		if (isTimeout(error, signal)) {
			throw new ComicVineError('ComicVine request timed out. Please try again.', 504);
		}
		throw new ComicVineError('Unable to reach ComicVine. Please try again.');
	}
}

async function throwComicVineHttpError(response: Response): Promise<never> {
	if (response.status !== 420) {
		throw new ComicVineError(`ComicVine request failed with ${response.status}.`, 502);
	}

	const retryAfter = retryAfterSeconds(response.headers?.get('retry-after') ?? null);
	await setCooldown(retryAfter);
	throw cooldownError(comicVineCache.cooldownUntil);
}

async function readComicVineResults<T>(response: Response, signal: AbortSignal) {
	try {
		return ensureResults((await response.json()) as ComicVineResponse<T>);
	} catch (error) {
		if (error instanceof ComicVineError) throw error;
		if (isTimeout(error, signal)) {
			throw new ComicVineError('ComicVine request timed out. Please try again.', 504);
		}
		throw new ComicVineError('ComicVine returned an invalid response.');
	}
}

export function normalizeSearchIssue(
	raw: ComicVineRecord,
	volumesById: ReadonlyMap<number, SearchVolume> = new Map()
): ComicVineSearchIssue | null {
	const id = numberId(raw.id);
	const volumeRef = normalizeRef(raw.volume);
	if (!id || !volumeRef.id || !volumeRef.name) return null;
	const volume = volumesById.get(volumeRef.id) ?? {
		id: volumeRef.id,
		name: volumeRef.name,
		startYear: null,
		issueCount: null,
		coverImageUrl: null,
		publisher: null
	};

	return {
		id,
		name: text(raw.name),
		issueNumber: issueNumber(raw.issue_number),
		coverDate: text(raw.cover_date),
		coverImageUrl: imageUrl(raw.image),
		volume,
		siteDetailUrl: text(raw.site_detail_url)
	};
}

export function normalizeIssueDetail(raw: ComicVineRecord): ComicVineIssueDetail {
	const id = numberId(raw.id);
	if (!id) {
		throw new ComicVineError('ComicVine issue detail is missing an id.');
	}

	const characterCredits = Array.isArray(raw.character_credits) ? raw.character_credits : [];
	const personCredits = Array.isArray(raw.person_credits) ? raw.person_credits : [];

	return {
		id,
		name: text(raw.name),
		issueNumber: issueNumber(raw.issue_number),
		coverDate: text(raw.cover_date),
		storeDate: text(raw.store_date),
		coverImageUrl: imageUrl(raw.image),
		descriptionHtml: text(raw.description),
		summary: text(raw.deck),
		volume: normalizeRef(raw.volume),
		characters: characterCredits
			.map((character: ComicVineReference) => ({
				id: numberId(character.id),
				name: text(character.name),
				imageUrl: imageUrl(character.image)
			}))
			.filter(
				(character: {
					id: number | null;
					name: string | null;
				}): character is {
					id: number;
					name: string;
					imageUrl: string | null;
				} => Boolean(character.id && character.name)
			),
		credits: personCredits
			.map((credit: ComicVineReference) => ({
				id: numberId(credit.id),
				name: text(credit.name),
				roles: rolesForCredit(credit)
			}))
			.filter(
				(credit: {
					id: number | null;
					name: string | null;
					roles: string[];
				}): credit is {
					id: number;
					name: string;
					roles: string[];
				} => Boolean(credit.id && credit.name)
			),
		raw
	};
}

export function normalizeVolumeDetail(raw: ComicVineRecord): ComicVineVolumeDetail {
	const id = numberId(raw.id);
	const name = text(raw.name);

	if (!id || !name) {
		throw new ComicVineError('ComicVine volume detail is missing an id or name.');
	}

	const publisher = normalizeRef(raw.publisher);

	return {
		id,
		name,
		startYear: text(raw.start_year),
		status: text(raw.status),
		summary: text(raw.deck) ?? text(raw.description),
		issueCount: numberId(raw.count_of_issues),
		coverImageUrl: imageUrl(raw.image),
		publisher: publisher.id && publisher.name ? { id: publisher.id, name: publisher.name } : null,
		raw
	};
}

export function normalizeSearchVolume(raw: ComicVineRecord): SearchVolume | null {
	const id = numberId(raw.id);
	const name = text(raw.name);

	if (!id || !name) return null;
	const publisher = normalizeRef(raw.publisher);
	return {
		id,
		name,
		startYear: text(raw.start_year),
		issueCount: numberId(raw.count_of_issues),
		coverImageUrl: imageUrl(raw.image),
		publisher: publisher.id && publisher.name ? { id: publisher.id, name: publisher.name } : null
	};
}

export function resetComicVineCaches() {
	comicVineCache.cooldownUntil = 0;
	comicVineCache.cooldownUpdatePromise = undefined;
	comicVineCache.searchPromises.clear();
	comicVineCache.searchResults.clear();
	comicVineCache.characterPromises.clear();
	comicVineCache.characterResults.clear();
}

export type ComicSearchOptions = {
	title?: string;
	issue?: string;
	volumeId?: number;
	characterIds?: number[];
	publisherId?: number;
	suggest?: 'character' | 'publisher';
	query?: string;
	sort?: 'issue-asc' | 'issue-desc' | 'date-desc';
	offset?: number;
};

function normalizedTitle(value: string) {
	return value
		.normalize('NFKD')
		.toLocaleLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '');
}

function isDcPublisherName(name: string | null | undefined) {
	return DC_PUBLISHERS.has(name?.toLocaleLowerCase() ?? '');
}

function isDcSearchVolume(volume: SearchVolume) {
	return isDcPublisherName(volume.publisher?.name);
}

function volumeRank(name: string, query: string) {
	const normalizedName = normalizedTitle(name);
	if (normalizedName === query) return 0;
	if (normalizedName.startsWith(query)) return 1;
	return 2;
}

async function matchingVolumes(title: string) {
	const filterTitle = title.replace(/[,:|]/g, ' ').replace(/\s+/g, ' ').trim();
	const query = normalizedTitle(filterTitle);
	const fields = 'id,name,start_year,count_of_issues,image,publisher';
	const rankResults = (results: ComicVineRecord[]) =>
		results
			.map(normalizeSearchVolume)
			.filter((volume): volume is SearchVolume => Boolean(volume))
			.filter(isDcSearchVolume)
			.filter((volume) => normalizedTitle(volume.name).includes(query))
			.sort((first, second) => {
				const rank = volumeRank(first.name, query) - volumeRank(second.name, query);
				const yearOrder = (Number(second.startYear) || 0) - (Number(first.startYear) || 0);
				return rank || yearOrder || first.name.localeCompare(second.name) || second.id - first.id;
			});
	const filtered = rankResults(
		await comicVineGet<ComicVineRecord[]>('/volumes/', {
			filter: `name:${filterTitle}`,
			limit: 100,
			field_list: fields
		})
	);
	if (filtered.length) return filtered;

	return rankResults(
		await comicVineGet<ComicVineRecord[]>('/search/', {
			query: filterTitle,
			resources: 'volume',
			limit: 100,
			field_list: fields
		})
	);
}

function rankVolumes(volumes: SearchVolume[], title?: string) {
	const query = title ? normalizedTitle(title) : '';
	return volumes.sort((first, second) => {
		const rank = query ? volumeRank(first.name, query) - volumeRank(second.name, query) : 0;
		const yearOrder = (Number(second.startYear) || 0) - (Number(first.startYear) || 0);
		return rank || yearOrder || first.name.localeCompare(second.name) || second.id - first.id;
	});
}

function chunked<T>(values: T[], size: number) {
	return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
		values.slice(index * size, (index + 1) * size)
	);
}

async function volumesByIds(ids: number[]) {
	if (!ids.length) return [];
	const fields = 'id,name,start_year,count_of_issues,image,publisher';
	const batches = await Promise.all(
		chunked(ids, CREDIT_BATCH_SIZE).map((batch) =>
			comicVineGet<ComicVineRecord[]>('/volumes/', {
				filter: `id:${batch.join('|')}`,
				limit: 100,
				field_list: fields
			})
		)
	);
	return batches
		.flat()
		.map(normalizeSearchVolume)
		.filter((volume): volume is SearchVolume => Boolean(volume))
		.filter(isDcSearchVolume);
}

function validCharacterCredits(value: unknown): value is CharacterCredits {
	const credits = objectRecord(value);
	return Array.isArray(credits?.issueIds) && credits.issueIds.every((id) => typeof id === 'number');
}

async function characterCredits(characterId: number) {
	const memoryCached = memoryCacheGet(comicVineCache.characterResults, characterId);
	if (memoryCached) return memoryCached;
	const pending = comicVineCache.characterPromises.get(characterId);
	if (pending) return pending;

	const request = (async () => {
		const runtimeKey = `character:${characterId}`;
		const runtimeCached = await runtimeCacheGet(runtimeKey);
		if (validCharacterCredits(runtimeCached)) {
			memoryCacheSet(
				comicVineCache.characterResults,
				characterId,
				runtimeCached,
				SEARCH_RESULT_TTL_MS
			);
			return runtimeCached;
		}

		const raw = await comicVineGet<ComicVineRecord>(`/character/4005-${characterId}/`, {
			field_list: 'publisher,issue_credits'
		});
		const refs = (value: unknown) =>
			(Array.isArray(value) ? value : [])
				.map((reference) => numberId(objectRecord(reference)?.id))
				.filter((id): id is number => Boolean(id));
		const credits = isDcPublisherName(normalizeRef(raw.publisher).name)
			? { issueIds: refs(raw.issue_credits) }
			: { issueIds: [] };
		memoryCacheSet(comicVineCache.characterResults, characterId, credits, SEARCH_RESULT_TTL_MS);
		await runtimeCacheSet(runtimeKey, credits, SEARCH_RESULT_TTL_MS / 1000);
		return credits;
	})();

	comicVineCache.characterPromises.set(characterId, request);
	try {
		return await request;
	} finally {
		comicVineCache.characterPromises.delete(characterId);
	}
}

async function intersectedCharacterCredits(characterIds: number[]) {
	if (!characterIds.length) return null;
	const credits = await Promise.all(characterIds.map(characterCredits));
	const intersect = (values: number[][]) => {
		const result = new Set(values[0] ?? []);
		for (const ids of values.slice(1)) {
			const current = new Set(ids);
			for (const id of result) if (!current.has(id)) result.delete(id);
		}
		return result;
	};
	return {
		issueIds: intersect(credits.map((credit) => credit.issueIds))
	};
}

async function volumesForIssueIds(issueIds: number[]) {
	if (!issueIds.length) return [];
	const records = await comicVineGet<ComicVineRecord[]>('/issues/', {
		filter: `id:${issueIds.join('|')}`,
		limit: 100,
		field_list: 'id,volume'
	});
	const volumeIds = Array.from(
		new Set(
			records
				.map((record) => normalizeRef(record.volume).id)
				.filter((id): id is number => Boolean(id))
		)
	);
	return volumesByIds(volumeIds);
}

async function characterVolumePage(
	issueIds: ReadonlySet<number>,
	title: string | undefined,
	publisherId: number | undefined,
	offset: number
) {
	const sortedIssueIds = [...issueIds].sort((first, second) => second - first);
	const pageIssueIds = sortedIssueIds.slice(offset, offset + CHARACTER_ISSUE_PAGE_SIZE);
	const normalizedQuery = title ? normalizedTitle(title) : '';
	let volumes = await volumesForIssueIds(pageIssueIds);
	if (normalizedQuery) {
		volumes = volumes.filter((volume) => normalizedTitle(volume.name).includes(normalizedQuery));
	}
	if (publisherId) volumes = volumes.filter((volume) => volume.publisher?.id === publisherId);
	const hasMore = sortedIssueIds.length > offset + CHARACTER_ISSUE_PAGE_SIZE;
	return {
		volumes: rankVolumes(volumes, title).slice(0, SEARCH_PAGE_SIZE),
		hasMore,
		nextOffset: hasMore ? offset + CHARACTER_ISSUE_PAGE_SIZE : undefined
	};
}

function normalizeSuggestion(
	raw: ComicVineRecord,
	type: 'character' | 'publisher'
): SearchSuggestion | null {
	const id = numberId(raw.id);
	const label = text(raw.name);
	if (!id || !label) return null;
	const publisher = normalizeRef(raw.publisher).name;
	if (type === 'publisher' ? !isDcPublisherName(label) : !isDcPublisherName(publisher)) return null;
	return { id, type, label, subtitle: type === 'character' ? publisher : null };
}

async function searchSuggestions(type: 'character' | 'publisher', query: string) {
	const results = await comicVineGet<ComicVineRecord[]>('/search/', {
		query,
		resources: type,
		limit: 8,
		field_list: 'id,name,publisher'
	});
	return {
		mode: 'suggestions' as const,
		results: results
			.map((result) => normalizeSuggestion(result, type))
			.filter((result): result is SearchSuggestion => Boolean(result))
			.slice(0, 8),
		hasMore: false as const
	};
}

function volumeFromDetail(volume: ComicVineVolumeDetail): SearchVolume {
	return {
		id: volume.id,
		name: volume.name,
		startYear: volume.startYear,
		issueCount: volume.issueCount,
		coverImageUrl: volume.coverImageUrl,
		publisher: volume.publisher
	};
}

const ISSUE_FIELDS = 'id,name,issue_number,cover_date,image,volume,site_detail_url';
const issueNumberCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

async function issuesForVolumes(
	volumes: SearchVolume[],
	issue: string | undefined,
	sort: ComicSearchOptions['sort'],
	offset: number,
	allowedIssueIds?: ReadonlySet<number>
): Promise<Extract<ComicSearchResponse, { mode: 'issues' }>> {
	if (!volumes.length) return { mode: 'issues', results: [], hasMore: false };
	const cleanIssue = issue?.trim().replace(/^#/, '');
	const pageSize = cleanIssue ? 100 : ISSUE_PAGE_SIZE;
	const filter = [
		`volume:${volumes.map((volume) => volume.id).join('|')}`,
		cleanIssue ? `issue_number:${cleanIssue}` : null
	]
		.filter(Boolean)
		.join(',');
	const sortValue =
		sort === 'issue-desc'
			? 'issue_number:desc'
			: sort === 'date-desc'
				? 'cover_date:desc'
				: 'issue_number:asc';
	const rawIssues = await comicVineGet<ComicVineRecord[]>('/issues/', {
		filter,
		sort: sortValue,
		limit: cleanIssue ? pageSize : pageSize + 1,
		offset: cleanIssue ? undefined : offset,
		field_list: ISSUE_FIELDS
	});
	const volumesById = new Map(volumes.map((volume) => [volume.id, volume]));
	const normalized = rawIssues
		.map((raw) => normalizeSearchIssue(raw, volumesById))
		.filter((result): result is SearchIssue => Boolean(result))
		.filter((result) => !allowedIssueIds || allowedIssueIds.has(result.id));
	const volumeOrder = new Map(volumes.map((volume, index) => [volume.id, index]));
	normalized.sort((first, second) => {
		if (cleanIssue) {
			return (volumeOrder.get(first.volume.id) ?? 0) - (volumeOrder.get(second.volume.id) ?? 0);
		}
		if (sort === 'date-desc') {
			return (second.coverDate ?? '').localeCompare(first.coverDate ?? '');
		}
		const order = issueNumberCollator.compare(first.issueNumber, second.issueNumber);
		return sort === 'issue-desc' ? -order : order;
	});

	return {
		mode: 'issues',
		results: normalized.slice(0, pageSize),
		hasMore: !cleanIssue && rawIssues.length > pageSize,
		...(!cleanIssue && rawIssues.length > pageSize ? { nextOffset: offset + pageSize } : {})
	};
}

async function performComicSearch(options: ComicSearchOptions): Promise<ComicSearchResponse> {
	if (options.suggest && options.query) return searchSuggestions(options.suggest, options.query);

	const offset = Math.max(0, options.offset ?? 0);
	const credits = await intersectedCharacterCredits(options.characterIds ?? []);
	if (options.volumeId) {
		const volume = volumeFromDetail(await fetchComicVineVolume(options.volumeId));
		if (!isDcSearchVolume(volume)) return { mode: 'issues', results: [], hasMore: false };
		if (options.publisherId && volume.publisher?.id !== options.publisherId) {
			return { mode: 'issues', results: [], hasMore: false };
		}
		return issuesForVolumes([volume], options.issue, options.sort, offset, credits?.issueIds);
	}
	if (credits) {
		const page = await characterVolumePage(
			credits.issueIds,
			options.title,
			options.publisherId,
			offset
		);
		if (options.issue) {
			const response = await issuesForVolumes(
				page.volumes,
				options.issue,
				options.sort,
				0,
				credits.issueIds
			);
			return {
				...response,
				hasMore: page.hasMore,
				...(page.nextOffset ? { nextOffset: page.nextOffset } : {})
			};
		}
		return {
			mode: 'volumes',
			results: page.volumes,
			hasMore: page.hasMore,
			...(page.nextOffset ? { nextOffset: page.nextOffset } : {})
		};
	}

	let volumes = options.title ? await matchingVolumes(options.title) : [];
	if (options.publisherId) {
		volumes = volumes.filter((volume) => volume.publisher?.id === options.publisherId);
	}
	volumes = rankVolumes(volumes, options.title);
	if (options.issue) {
		const page = volumes.slice(offset, offset + SEARCH_PAGE_SIZE);
		const response = await issuesForVolumes(page, options.issue, options.sort, 0);
		const hasMore = volumes.length > offset + SEARCH_PAGE_SIZE;
		return {
			...response,
			hasMore,
			...(hasMore ? { nextOffset: offset + SEARCH_PAGE_SIZE } : {})
		};
	}

	const hasMore = volumes.length > offset + SEARCH_PAGE_SIZE;
	return {
		mode: 'volumes',
		results: volumes.slice(offset, offset + SEARCH_PAGE_SIZE),
		hasMore,
		...(hasMore ? { nextOffset: offset + SEARCH_PAGE_SIZE } : {})
	};
}

export async function searchComicVine(options: ComicSearchOptions) {
	const normalizedOptions = {
		...options,
		title: options.title?.trim().replace(/\s+/g, ' '),
		issue: options.issue?.trim().replace(/^#/, ''),
		query: options.query?.trim().replace(/\s+/g, ' '),
		characterIds: Array.from(new Set(options.characterIds ?? [])).sort((a, b) => a - b),
		offset: Math.max(0, options.offset ?? 0),
		sort: options.sort ?? 'issue-asc'
	};
	const cacheKey = JSON.stringify(normalizedOptions).toLocaleLowerCase();
	const memoryCached = memoryCacheGet(comicVineCache.searchResults, cacheKey);
	if (memoryCached !== undefined) return memoryCached;

	const pending = comicVineCache.searchPromises.get(cacheKey);
	if (pending) return pending;

	const search = (async () => {
		const runtimeCached = cachedSearchResponse(await runtimeCacheGet(`search:${cacheKey}`));
		if (runtimeCached) {
			memoryCacheSet(comicVineCache.searchResults, cacheKey, runtimeCached, SEARCH_RESULT_TTL_MS);
			return runtimeCached;
		}

		await assertNotCoolingDown();
		const results = await performComicSearch(normalizedOptions);

		memoryCacheSet(comicVineCache.searchResults, cacheKey, results, SEARCH_RESULT_TTL_MS);
		await runtimeCacheSet(`search:${cacheKey}`, results, SEARCH_RESULT_TTL_MS / 1000);
		return results;
	})();

	comicVineCache.searchPromises.set(cacheKey, search);

	try {
		return await search;
	} finally {
		comicVineCache.searchPromises.delete(cacheKey);
	}
}

export function isDcComicVineVolume(volume: ComicVineVolumeDetail | null) {
	return DC_PUBLISHERS.has(volume?.publisher?.name.toLowerCase() ?? '');
}

export async function getComicVineIssue(issueId: number) {
	await assertNotCoolingDown();
	const result = await comicVineGet<ComicVineRecord>(`/issue/4000-${issueId}/`, {
		field_list:
			'id,name,issue_number,cover_date,store_date,image,description,deck,volume,character_credits,person_credits'
	});

	return normalizeIssueDetail(result);
}

async function fetchComicVineVolume(volumeId: number) {
	const result = await comicVineGet<ComicVineRecord>(`/volume/4050-${volumeId}/`, {
		field_list: 'id,name,start_year,status,deck,description,count_of_issues,image,publisher'
	});

	return normalizeVolumeDetail(result);
}

export async function getComicVineVolume(volumeId: number) {
	await assertNotCoolingDown();
	return fetchComicVineVolume(volumeId);
}
