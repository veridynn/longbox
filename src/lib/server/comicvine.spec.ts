import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({
	env: {
		COMIC_VINE_API_KEY: 'test-key'
	}
}));

import {
	ComicVineError,
	isDcComicVineVolume,
	normalizeIssueDetail,
	normalizeSearchIssue,
	normalizeVolumeDetail,
	resetComicVineCaches,
	searchComicVineIssues
} from './comicvine';

afterEach(() => {
	vi.unstubAllGlobals();
	resetComicVineCaches();
});

describe('ComicVine normalization', () => {
	it('normalizes issue search results', () => {
		expect(
			normalizeSearchIssue({
				id: '123',
				name: 'The Last Laugh',
				issue_number: '7',
				cover_date: '2025-02-01',
				image: { medium_url: 'https://img.example/issue.jpg' },
				volume: { id: '456', name: 'Detective Comics' },
				site_detail_url: 'https://comicvine.example/issue'
			})
		).toEqual({
			id: 123,
			name: 'The Last Laugh',
			issueNumber: '7',
			coverDate: '2025-02-01',
			coverImageUrl: 'https://img.example/issue.jpg',
			volume: {
				id: 456,
				name: 'Detective Comics'
			},
			apiDetailUrl: null,
			siteDetailUrl: 'https://comicvine.example/issue'
		});
	});

	it('normalizes issue details with characters and credit roles', () => {
		const issue = normalizeIssueDetail({
			id: 123,
			name: '',
			issue_number: '7',
			cover_date: '2025-02-01',
			store_date: '2025-01-15',
			image: { small_url: 'https://img.example/small.jpg' },
			description: '<p>Story</p>',
			deck: 'Short summary',
			volume: { id: 456, name: 'Detective Comics' },
			character_credits: [
				{ id: 1, name: 'Batman', image: { icon_url: 'https://img.example/batman.jpg' } },
				{ id: null, name: 'Ignored' }
			],
			person_credits: [
				{ id: 2, name: 'Jane Writer', role: 'writer, editor' },
				{ id: 3, name: 'No Role' }
			]
		});

		expect(issue.name).toBeNull();
		expect(issue.coverImageUrl).toBe('https://img.example/small.jpg');
		expect(issue.characters).toEqual([
			{ id: 1, name: 'Batman', imageUrl: 'https://img.example/batman.jpg' }
		]);
		expect(issue.credits).toEqual([
			{ id: 2, name: 'Jane Writer', roles: ['writer', 'editor'] },
			{ id: 3, name: 'No Role', roles: ['credit'] }
		]);
	});

	it('normalizes volume publisher data', () => {
		expect(
			normalizeVolumeDetail({
				id: 456,
				name: 'Detective Comics',
				start_year: '1937',
				status: 'Continuing',
				deck: 'The classic series',
				count_of_issues: '1000',
				image: { thumb_url: 'https://img.example/volume.jpg' },
				publisher: { id: 10, name: 'DC Comics' }
			})
		).toMatchObject({
			id: 456,
			name: 'Detective Comics',
			startYear: '1937',
			status: 'Continuing',
			issueCount: 1000,
			coverImageUrl: 'https://img.example/volume.jpg',
			publisher: { id: 10, name: 'DC Comics' }
		});
	});

	it('reports malformed ComicVine JSON as an upstream response error', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
			})
		);

		await expect(searchComicVineIssues('batman')).rejects.toThrow(
			new ComicVineError('ComicVine returned an invalid response.')
		);
	});

	it('recognizes the DC publisher family case-insensitively', () => {
		for (const name of ['DC Comics', 'Vertigo', 'WildStorm', 'DC Black Label', 'Milestone Media']) {
			expect(isDcComicVineVolume({ publisher: { id: 1, name } } as never)).toBe(true);
		}

		for (const name of ['Image Comics', 'Marvel', 'Unknown Publisher']) {
			expect(isDcComicVineVolume({ publisher: { id: 1, name } } as never)).toBe(false);
		}
		expect(isDcComicVineVolume(null)).toBe(false);
	});

	it('over-fetches DC-family results and reuses volume lookups', async () => {
		const responses = [
			{ status_code: 1, results: { volumes: [] } },
			{
				status_code: 1,
				results: [
					{ id: 1, issue_number: '1', volume: { id: 20, name: 'Spawn' } },
					{ id: 2, issue_number: '1', volume: { id: 10, name: 'Batman' } },
					{ id: 3, issue_number: '2', volume: { id: 10, name: 'Batman' } },
					{ id: 4, issue_number: '1', volume: { id: 30, name: 'The Sandman Universe' } }
				]
			},
			{ status_code: 1, results: { id: 20, name: 'Spawn', publisher: { id: 31, name: 'Image' } } },
			{
				status_code: 1,
				results: { id: 10, name: 'Batman', publisher: { id: 10, name: 'DC Comics' } }
			},
			{
				status_code: 1,
				results: { id: 30, name: 'The Sandman Universe', publisher: { id: 1, name: 'Vertigo' } }
			}
		];
		const fetchMock = vi
			.fn()
			.mockImplementation(() =>
				Promise.resolve({ ok: true, json: () => Promise.resolve(responses.shift()) })
			);
		vi.stubGlobal('fetch', fetchMock);

		await expect(searchComicVineIssues('batman')).resolves.toMatchObject([
			{ id: 2 },
			{ id: 3 },
			{ id: 4 }
		]);
		expect(fetchMock).toHaveBeenCalledTimes(5);
		expect(fetchMock.mock.calls[1]?.[0].searchParams.get('limit')).toBe('50');
	});

	it('falls back to partial DC volume-name matches', async () => {
		const responses = [
			{
				status_code: 1,
				results: {
					volumes: [
						{ id: 30, name: 'Man-Bat' },
						{ id: 9, name: 'Batman' },
						{ id: 10, name: 'Batman' },
						{ id: 40, name: 'Superman' }
					]
				}
			},
			{
				status_code: 1,
				results: [{ id: 2, issue_number: '1', volume: { id: 10, name: 'Batman' } }]
			},
			{
				status_code: 1,
				results: [{ id: 1, issue_number: '1', volume: { id: 30, name: 'Man-Bat' } }]
			},
			{
				status_code: 1,
				results: [{ id: 3, issue_number: '1', volume: { id: 40, name: 'Superman' } }]
			}
		];
		const fetchMock = vi
			.fn()
			.mockImplementation(() =>
				Promise.resolve({ ok: true, json: () => Promise.resolve(responses.shift()) })
			);
		vi.stubGlobal('fetch', fetchMock);

		await expect(searchComicVineIssues('man')).resolves.toMatchObject([
			{ id: 2, volume: { name: 'Batman' } },
			{ id: 1, volume: { name: 'Man-Bat' } },
			{ id: 3, volume: { name: 'Superman' } }
		]);
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(fetchMock.mock.calls[0]?.[0].pathname).toBe('/api/publisher/4010-10/');
		expect(fetchMock.mock.calls[0]?.[0].searchParams.get('field_list')).toBe('volumes');
		expect(fetchMock.mock.calls[1]?.[0].searchParams.get('filter')).toBe('volume:10');
		expect(fetchMock.mock.calls[2]?.[0].searchParams.get('filter')).toBe('volume:30');
		expect(fetchMock.mock.calls[3]?.[0].searchParams.get('filter')).toBe('volume:40');

		responses.push(
			{
				status_code: 1,
				results: [{ id: 2, issue_number: '1', volume: { id: 10, name: 'Batman' } }]
			},
			{
				status_code: 1,
				results: [{ id: 1, issue_number: '1', volume: { id: 30, name: 'Man-Bat' } }]
			},
			{
				status_code: 1,
				results: [{ id: 3, issue_number: '1', volume: { id: 40, name: 'Superman' } }]
			}
		);
		await searchComicVineIssues('man');
		expect(fetchMock).toHaveBeenCalledTimes(7);
		expect(
			fetchMock.mock.calls.filter(([url]) => url.pathname === '/api/publisher/4010-10/')
		).toHaveLength(1);
	});

	it('maps ComicVine velocity limits to a retryable response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 420 }));

		await expect(searchComicVineIssues('man')).rejects.toMatchObject({
			message: 'ComicVine is temporarily rate limiting requests.',
			status: 429
		});
	});
});
