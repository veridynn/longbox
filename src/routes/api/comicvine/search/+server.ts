import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ComicVineError, searchComicVineIssues } from '$lib/server/comicvine';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim().replace(/\s+/g, ' ');
	const headers = { 'cache-control': 'no-store' };

	if (!query) {
		return json({ error: 'Search query is required.' }, { status: 400, headers });
	}

	try {
		const results = await searchComicVineIssues(query);
		return json({ results }, { headers });
	} catch (error) {
		if (error instanceof ComicVineError) {
			return json(
				{ error: error.message },
				{
					status: error.status,
					headers: error.retryAfterSeconds
						? { ...headers, 'retry-after': String(error.retryAfterSeconds) }
						: headers
				}
			);
		}

		return json({ error: 'Unable to search ComicVine.' }, { status: 502, headers });
	}
};
