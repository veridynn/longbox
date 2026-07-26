import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ComicVineError, searchComicVine } from '$lib/server/comicvine';

export const GET: RequestHandler = async ({ url }) => {
	const title = url.searchParams.get('title')?.trim().replace(/\s+/g, ' ');
	const issue = url.searchParams.get('issue')?.trim().replace(/^#/, '');
	const volumeId = Number(url.searchParams.get('volumeId'));
	const publisherId = Number(url.searchParams.get('publisherId'));
	const characterValues = url.searchParams.getAll('characterId');
	const characterIds = characterValues.map(Number);
	const suggest = url.searchParams.get('suggest');
	const query = url.searchParams.get('q')?.trim().replace(/\s+/g, ' ');
	const offset = Number(url.searchParams.get('offset') ?? '0');
	const requestedSort = url.searchParams.get('sort') ?? 'issue-asc';
	const sort = ['issue-asc', 'issue-desc', 'date-desc'].includes(requestedSort)
		? (requestedSort as 'issue-asc' | 'issue-desc' | 'date-desc')
		: null;
	const headers = { 'cache-control': 'no-store' };
	const hasValidVolumeId =
		url.searchParams.has('volumeId') && Number.isInteger(volumeId) && volumeId > 0;
	const hasValidPublisherId =
		!url.searchParams.has('publisherId') || (Number.isInteger(publisherId) && publisherId > 0);
	const hasValidCharacterIds =
		characterIds.length <= 10 &&
		characterIds.every((id) => Number.isInteger(id) && id > 0) &&
		new Set(characterIds).size === characterIds.length;

	if (suggest) {
		if ((suggest !== 'character' && suggest !== 'publisher') || !query || query.length < 2) {
			return json({ error: 'Invalid suggestion search.' }, { status: 400, headers });
		}
		try {
			return json(await searchComicVine({ suggest, query }), { headers });
		} catch (error) {
			return comicVineErrorResponse(error, headers);
		}
	}

	if ((!title || title.length < 2) && !characterIds.length && !hasValidVolumeId) {
		return json({ error: 'Add a volume or character search.' }, { status: 400, headers });
	}
	if (
		(url.searchParams.has('volumeId') && !hasValidVolumeId) ||
		!hasValidPublisherId ||
		!hasValidCharacterIds ||
		!sort ||
		!Number.isInteger(offset) ||
		offset < 0
	) {
		return json({ error: 'Invalid search options.' }, { status: 400, headers });
	}

	try {
		const response = await searchComicVine({
			title,
			issue: issue || undefined,
			volumeId: hasValidVolumeId ? volumeId : undefined,
			characterIds,
			publisherId: url.searchParams.has('publisherId') ? publisherId : undefined,
			sort,
			offset
		});
		return json(response, { headers });
	} catch (error) {
		return comicVineErrorResponse(error, headers);
	}
};

function comicVineErrorResponse(error: unknown, headers: Record<string, string>) {
	if (
		error instanceof ComicVineError ||
		(error instanceof Error && 'status' in error && typeof error.status === 'number')
	) {
		const comicVineError = error as ComicVineError;
		return json(
			{
				error:
					comicVineError.status === 429
						? 'Search is temporarily unavailable. Try again later.'
						: 'Unable to search. Try again.'
			},
			{
				status: comicVineError.status,
				headers: comicVineError.retryAfterSeconds
					? { ...headers, 'retry-after': String(comicVineError.retryAfterSeconds) }
					: headers
			}
		);
	}

	return json({ error: 'Unable to search. Try again.' }, { status: 502, headers });
}
