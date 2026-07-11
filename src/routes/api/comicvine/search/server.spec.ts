import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { searchComicVineIssues } from '$lib/server/comicvine';

vi.mock('$lib/server/comicvine', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/comicvine')>();

	return {
		...actual,
		searchComicVineIssues: vi.fn()
	};
});

describe('GET /api/comicvine/search', () => {
	beforeEach(() => {
		vi.mocked(searchComicVineIssues).mockReset();
	});

	it('rejects empty queries', async () => {
		const response = await GET({ url: new URL('http://localhost/api/comicvine/search') } as never);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Search query is required.' });
	});

	it('returns normalized search results', async () => {
		vi.mocked(searchComicVineIssues).mockResolvedValue([
			{
				id: 123,
				name: 'The Last Laugh',
				issueNumber: '7',
				coverDate: '2025-02-01',
				coverImageUrl: 'https://img.example/issue.jpg',
				volume: { id: 456, name: 'Detective Comics' },
				apiDetailUrl: null,
				siteDetailUrl: null
			}
		]);

		const response = await GET({
			url: new URL('http://localhost/api/comicvine/search?q=batman')
		} as never);

		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		await expect(response.json()).resolves.toEqual({
			results: [
				{
					id: 123,
					name: 'The Last Laugh',
					issueNumber: '7',
					coverDate: '2025-02-01',
					coverImageUrl: 'https://img.example/issue.jpg',
					volume: { id: 456, name: 'Detective Comics' },
					apiDetailUrl: null,
					siteDetailUrl: null
				}
			]
		});
		expect(searchComicVineIssues).toHaveBeenCalledWith('batman');
	});
});
