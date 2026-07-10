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
	searchComicVineIssues
} from './comicvine';

afterEach(() => {
	vi.unstubAllGlobals();
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
		expect(fetchMock).toHaveBeenCalledTimes(4);
		expect(fetchMock.mock.calls[0]?.[0].searchParams.get('limit')).toBe('50');
	});
});
