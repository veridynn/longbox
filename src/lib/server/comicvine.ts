import { env } from '$env/dynamic/private';
import { getCache } from '@vercel/functions';

const COMIC_VINE_BASE_URL = 'https://comicvine.gamespot.com/api';
const SEARCH_RESULT_TTL_MS = 5 * 60 * 1000;
const MAX_MEMORY_CACHE_ENTRIES = 100;
const MAX_CONCURRENT_REQUESTS = 3;
const VOLUME_SEARCH_LIMIT = 25;
const TITLE_SEARCH_LIMIT = 50;
const COMIC_VINE_TIMEOUT_MS = 12_000;
const DEFAULT_COOLDOWN_SECONDS = 60;
const RUNTIME_CACHE_NAMESPACE = 'longbox-comicvine-v2';
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

export type ComicVineSearchIssue = {
	id: number;
	name: string | null;
	issueNumber: string;
	coverDate: string | null;
	coverImageUrl: string | null;
	volume: {
		id: number | null;
		name: string | null;
	};
	apiDetailUrl: string | null;
	siteDetailUrl: string | null;
};

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

type ComicVineSearchVolume = {
	id: number;
	name: string;
	publisher: { id: number; name: string } | null;
};

type CacheEntry<T> = { expiresAt: number; value: T };

type ComicVineCache = {
	cooldownUntil: number;
	cooldownUpdatePromise?: Promise<void>;
	activeRequests: number;
	requestWaiters: Array<() => void>;
	searchPromises: Map<string, Promise<ComicVineSearchIssue[]>>;
	searchResults: Map<string, CacheEntry<ComicVineSearchIssue[]>>;
};

const comicVineCache: ComicVineCache = ((
	globalThis as typeof globalThis & { __longboxComicVineCacheV2?: ComicVineCache }
).__longboxComicVineCacheV2 ??= {
	cooldownUntil: 0,
	activeRequests: 0,
	requestWaiters: [],
	searchPromises: new Map(),
	searchResults: new Map()
});

comicVineCache.cooldownUntil ??= 0;
comicVineCache.activeRequests ??= 0;
comicVineCache.requestWaiters ??= [];
comicVineCache.searchPromises ??= new Map();
comicVineCache.searchResults ??= new Map();

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

function cachedSearchIssues(value: unknown) {
	if (!Array.isArray(value)) return null;

	const valid = value.every((item) => {
		const issue = objectRecord(item);
		const volume = objectRecord(issue?.volume);
		return (
			typeof issue?.id === 'number' &&
			typeof issue.issueNumber === 'string' &&
			volume !== null &&
			(typeof volume.id === 'number' || volume.id === null) &&
			(typeof volume.name === 'string' || volume.name === null)
		);
	});

	return valid ? (value as ComicVineSearchIssue[]) : null;
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

export function normalizeSearchIssue(raw: ComicVineRecord): ComicVineSearchIssue | null {
	const id = numberId(raw.id);
	if (!id) return null;

	const volume = normalizeRef(raw.volume);

	return {
		id,
		name: text(raw.name),
		issueNumber: issueNumber(raw.issue_number),
		coverDate: text(raw.cover_date),
		coverImageUrl: imageUrl(raw.image),
		volume,
		apiDetailUrl: text(raw.api_detail_url),
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

function normalizeSearchVolume(raw: ComicVineRecord): ComicVineSearchVolume | null {
	const id = numberId(raw.id);
	const name = text(raw.name);

	if (!id || !name) return null;
	const publisher = normalizeRef(raw.publisher);
	return {
		id,
		name,
		publisher: publisher.id && publisher.name ? { id: publisher.id, name: publisher.name } : null
	};
}

export function resetComicVineCaches() {
	comicVineCache.cooldownUntil = 0;
	comicVineCache.cooldownUpdatePromise = undefined;
	comicVineCache.searchPromises.clear();
	comicVineCache.searchResults.clear();
}

async function searchIssuesByPartialVolumeName(query: string, limit: number) {
	const filterQuery = query.replace(/[,:|]/g, ' ').replace(/\s+/g, ' ').trim();
	if (filterQuery.length < 2) return null;

	const normalizedQuery = filterQuery.toLowerCase();
	const results = await comicVineGet<ComicVineRecord[]>('/volumes/', {
		filter: `name:${filterQuery}`,
		limit: VOLUME_SEARCH_LIMIT,
		field_list: 'id,name,publisher'
	});
	const volumesByName = new Map<string, ComicVineSearchVolume>();

	for (const raw of results) {
		const volume = normalizeSearchVolume(raw);
		if (!volume || !DC_PUBLISHERS.has(volume.publisher?.name.toLowerCase() ?? '')) continue;
		if (!volume.name.toLowerCase().includes(normalizedQuery)) continue;

		const name = volume.name.toLowerCase();
		const current = volumesByName.get(name);
		if (!current || volume.id > current.id) volumesByName.set(name, volume);
	}

	const volumes = [...volumesByName.values()]
		.sort((first, second) => {
			const length = first.name.length - second.name.length;
			const position =
				first.name.toLowerCase().indexOf(normalizedQuery) -
				second.name.toLowerCase().indexOf(normalizedQuery);
			return length || position || first.name.localeCompare(second.name);
		})
		.slice(0, Math.min(3, limit));

	if (!volumes.length) return null;

	const issues = await comicVineGet<ComicVineRecord[]>('/issues/', {
		filter: `volume:${volumes.map((volume) => volume.id).join('|')}`,
		sort: 'cover_date:desc',
		limit,
		field_list: 'id,name,issue_number,cover_date,image,volume,api_detail_url,site_detail_url'
	});

	return issues
		.map(normalizeSearchIssue)
		.filter((issue): issue is ComicVineSearchIssue => Boolean(issue))
		.slice(0, limit);
}

async function searchIssuesByTitle(query: string, limit: number) {
	const results = await comicVineGet<ComicVineRecord[]>('/search/', {
		query,
		resources: 'issue',
		limit: Math.min(Math.max(limit * 4, TITLE_SEARCH_LIMIT), 100),
		field_list: 'id,name,issue_number,cover_date,image,volume,api_detail_url,site_detail_url'
	});
	const issues = results
		.map(normalizeSearchIssue)
		.filter((issue): issue is ComicVineSearchIssue => Boolean(issue));
	const volumeIds = Array.from(
		new Set(issues.map((issue) => issue.volume.id).filter((id): id is number => Boolean(id)))
	);
	if (!volumeIds.length) return [];

	const volumes = await comicVineGet<ComicVineRecord[]>('/volumes/', {
		filter: `id:${volumeIds.join('|')}`,
		limit: volumeIds.length,
		field_list: 'id,name,publisher'
	});
	const dcVolumeIds = new Set(
		volumes
			.map(normalizeSearchVolume)
			.filter((volume): volume is ComicVineSearchVolume => Boolean(volume))
			.filter((volume) => DC_PUBLISHERS.has(volume.publisher?.name.toLowerCase() ?? ''))
			.map((volume) => volume.id)
	);

	return issues
		.filter((issue) => issue.volume.id && dcVolumeIds.has(issue.volume.id))
		.slice(0, limit);
}

export async function searchComicVineIssues(query: string, limit = 12) {
	const normalizedQuery = query.trim().replace(/\s+/g, ' ');
	const cacheKey = `${limit}:${normalizedQuery.toLowerCase()}`;
	const memoryCached = memoryCacheGet(comicVineCache.searchResults, cacheKey);
	if (memoryCached !== undefined) return memoryCached;

	const pending = comicVineCache.searchPromises.get(cacheKey);
	if (pending) return pending;

	const search = (async () => {
		const runtimeCached = cachedSearchIssues(await runtimeCacheGet(`search:${cacheKey}`));
		if (runtimeCached) {
			memoryCacheSet(comicVineCache.searchResults, cacheKey, runtimeCached, SEARCH_RESULT_TTL_MS);
			return runtimeCached;
		}

		await assertNotCoolingDown();
		const volumeIssues = await searchIssuesByPartialVolumeName(normalizedQuery, limit);
		const results = volumeIssues ?? (await searchIssuesByTitle(normalizedQuery, limit));

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
