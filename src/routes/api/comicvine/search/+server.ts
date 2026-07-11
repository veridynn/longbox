import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ComicVineError, searchComicVineIssues } from '$lib/server/comicvine';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q')?.trim();

	if (!query) {
		return json({ error: 'Search query is required.' }, { status: 400 });
	}

	try {
		const results = await searchComicVineIssues(query);
		return json({ results }, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		if (error instanceof ComicVineError) {
			return json({ error: error.message }, { status: error.status });
		}

		return json({ error: 'Unable to search ComicVine.' }, { status: 502 });
	}
};
