import { env } from '$env/dynamic/private';

const COMIC_VINE_BASE_URL = 'https://comicvine.gamespot.com/api';

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

export class ComicVineError extends Error {
	constructor(
		message: string,
		readonly status = 502
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
	const url = new URL(`${COMIC_VINE_BASE_URL}${path}`);
	url.searchParams.set('api_key', apiKey());
	url.searchParams.set('format', 'json');

	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') {
			url.searchParams.set(key, String(value));
		}
	}

	const response = await fetch(url, {
		headers: {
			accept: 'application/json',
			'user-agent': 'Longbox/0.1 (ComicVine import)'
		}
	});

	if (!response.ok) {
		throw new ComicVineError(`ComicVine request failed with ${response.status}.`, 502);
	}

	try {
		return ensureResults((await response.json()) as ComicVineResponse<T>);
	} catch (error) {
		if (error instanceof ComicVineError) {
			throw error;
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

export async function searchComicVineIssues(query: string, limit = 12) {
	const results = await comicVineGet<ComicVineRecord[]>('/search/', {
		query,
		resources: 'issue',
		limit,
		field_list: 'id,name,issue_number,cover_date,image,volume,api_detail_url,site_detail_url'
	});

	return results
		.map(normalizeSearchIssue)
		.filter((issue): issue is ComicVineSearchIssue => Boolean(issue));
}

export async function getComicVineIssue(issueId: number) {
	const result = await comicVineGet<ComicVineRecord>(`/issue/4000-${issueId}/`, {
		field_list:
			'id,name,issue_number,cover_date,store_date,image,description,deck,volume,character_credits,person_credits'
	});

	return normalizeIssueDetail(result);
}

export async function getComicVineVolume(volumeId: number) {
	const result = await comicVineGet<ComicVineRecord>(`/volume/4050-${volumeId}/`, {
		field_list: 'id,name,start_year,status,deck,description,count_of_issues,image,publisher'
	});

	return normalizeVolumeDetail(result);
}
