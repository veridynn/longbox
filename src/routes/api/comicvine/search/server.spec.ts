import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './+server';
import { searchComicVine } from '$lib/server/comicvine';

vi.mock('$lib/server/comicvine', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/comicvine')>();
	return { ...actual, searchComicVine: vi.fn() };
});

describe('GET /api/comicvine/search', () => {
	beforeEach(() => vi.mocked(searchComicVine).mockReset());

	it('requires a volume or character anchor', async () => {
		const response = await GET({
			url: new URL('http://localhost/api/comicvine/search?publisherId=10&issue=1')
		} as never);
		expect(response.status).toBe(400);
		expect(response.headers.get('cache-control')).toBe('no-store');
		await expect(response.json()).resolves.toEqual({
			error: 'Add a volume or character search.'
		});
	});

	it('validates facet ids and structured options', async () => {
		const response = await GET({
			url: new URL(
				'http://localhost/api/comicvine/search?characterId=1&characterId=nope&sort=random'
			)
		} as never);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Invalid search options.' });
	});

	it('returns DC character suggestions', async () => {
		vi.mocked(searchComicVine).mockResolvedValue({
			mode: 'suggestions',
			hasMore: false,
			results: [{ id: 1, type: 'character', label: 'Batman', subtitle: 'DC Comics' }]
		});
		const response = await GET({
			url: new URL('http://localhost/api/comicvine/search?suggest=character&q=%20Batman%20')
		} as never);

		expect(response.status).toBe(200);
		expect(searchComicVine).toHaveBeenCalledWith({ suggest: 'character', query: 'Batman' });
	});

	it('passes repeated character and publisher filters to the search service', async () => {
		vi.mocked(searchComicVine).mockResolvedValue({
			mode: 'issues',
			hasMore: false,
			results: []
		});
		const response = await GET({
			url: new URL(
				'http://localhost/api/comicvine/search?title=%20batman%20returns&characterId=1&characterId=2&publisherId=10&issue=%237&sort=date-desc'
			)
		} as never);

		expect(response.status).toBe(200);
		expect(searchComicVine).toHaveBeenCalledWith({
			title: 'batman returns',
			issue: '7',
			volumeId: undefined,
			characterIds: [1, 2],
			publisherId: 10,
			sort: 'date-desc',
			offset: 0
		});
	});
});
