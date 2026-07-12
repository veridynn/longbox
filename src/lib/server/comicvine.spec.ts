import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const runtimeCache = {
		delete: vi.fn(),
		expireTag: vi.fn(),
		get: vi.fn(),
		set: vi.fn()
	};

	return {
		env: {
			COMIC_VINE_API_KEY: 'test-key',
			VERCEL: undefined as string | undefined
		},
		getCache: vi.fn(() => runtimeCache),
		runtimeCache
	};
});

vi.mock('$env/dynamic/private', () => ({
	env: mocks.env
}));

vi.mock('@vercel/functions', () => ({ getCache: mocks.getCache }));

import {
	ComicVineError,
	getComicVineVolume,
	normalizeIssueDetail,
	normalizeSearchIssue,
	normalizeVolumeDetail,
	resetComicVineCaches,
	searchComicVineIssues
} from './comicvine';

beforeEach(() => {
	mocks.env.VERCEL = undefined;
	mocks.getCache.mockClear();
	mocks.runtimeCache.get.mockReset().mockResolvedValue(null);
	mocks.runtimeCache.set.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
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

	it('batches DC-family title verification and returns twelve results', async () => {
		const issues = Array.from({ length: 14 }, (_, index) => ({
			id: index + 1,
			issue_number: '1',
			volume: { id: index + 1, name: `Volume ${index + 1}` }
		}));
		const responses = [
			{ status_code: 1, results: [] },
			{ status_code: 1, results: issues },
			{
				status_code: 1,
				results: issues.map((issue, index) => ({
					id: issue.volume.id,
					name: issue.volume.name,
					publisher: { id: index ? 10 : 31, name: index ? 'Vertigo' : 'Image Comics' }
				}))
			}
		];
		const fetchMock = vi.fn((_url: URL) =>
			Promise.resolve({ ok: true, json: () => Promise.resolve(responses.shift()) })
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(searchComicVineIssues('last laugh')).resolves.toHaveLength(12);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls[1]?.[0].searchParams.get('limit')).toBe('50');
		expect(fetchMock.mock.calls[2]?.[0].searchParams.get('filter')).toContain('id:1|2|3');
	});

	it('searches matching DC-family volumes with one combined issue request', async () => {
		const responses = [
			{
				status_code: 1,
				results: [
					{ id: 10, name: 'Batman', publisher: { id: 10, name: 'DC Comics' } },
					{ id: 30, name: 'Sandman', publisher: { id: 1, name: 'Vertigo' } },
					{ id: 40, name: 'Spawn', publisher: { id: 31, name: 'Image Comics' } }
				]
			},
			{
				status_code: 1,
				results: [
					{ id: 1, issue_number: '1', volume: { id: 10, name: 'Batman' } },
					{ id: 2, issue_number: '1', volume: { id: 30, name: 'Sandman' } }
				]
			}
		];
		const fetchMock = vi.fn((_url: URL) =>
			Promise.resolve({ ok: true, json: () => Promise.resolve(responses.shift()) })
		);
		vi.stubGlobal('fetch', fetchMock);

		await expect(searchComicVineIssues('man')).resolves.toMatchObject([{ id: 1 }, { id: 2 }]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[0].pathname).toBe('/api/volumes/');
		expect(fetchMock.mock.calls[1]?.[0].searchParams.get('filter')).toBe('volume:10|30');
		expect(fetchMock.mock.calls.some(([url]) => url.pathname.includes('/publisher/'))).toBe(false);
	});

	it('times out upstream requests after twelve seconds', async () => {
		const signal = new AbortController().signal;
		const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal);
		const timeoutError = new Error('timed out');
		timeoutError.name = 'TimeoutError';
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(timeoutError)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ status_code: 1, results: { id: 1, name: 'Batman' } }))
			);
		vi.stubGlobal('fetch', fetchMock);

		await expect(searchComicVineIssues('batman')).rejects.toMatchObject({
			message: 'ComicVine request timed out. Please try again.',
			status: 504
		});
		expect(timeout).toHaveBeenCalledWith(12_000);
		await expect(getComicVineVolume(1)).resolves.toMatchObject({ id: 1 });
	});

	it('limits concurrent ComicVine requests to three and releases slots', async () => {
		const pending = Array.from({ length: 4 }, () => {
			let resolve!: (response: Response) => void;
			const promise = new Promise<Response>((resolvePromise) => (resolve = resolvePromise));
			return { promise, resolve };
		});
		const fetchMock = vi
			.fn()
			.mockImplementation(() => pending[fetchMock.mock.calls.length - 1].promise);
		vi.stubGlobal('fetch', fetchMock);

		const requests = [1, 2, 3, 4].map((id) => getComicVineVolume(id));
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
		pending[0].resolve(
			new Response(JSON.stringify({ status_code: 1, results: { id: 1, name: 'One' } }))
		);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));

		for (let index = 1; index < pending.length; index += 1) {
			pending[index].resolve(
				new Response(
					JSON.stringify({ status_code: 1, results: { id: index + 1, name: String(index + 1) } })
				)
			);
		}
		await expect(Promise.all(requests)).resolves.toHaveLength(4);
	});

	it('discards malformed Runtime Cache search results', async () => {
		mocks.env.VERCEL = '1';
		mocks.runtimeCache.get.mockImplementation((key) =>
			Promise.resolve(key.startsWith('search:') ? [{ id: 1 }] : null)
		);
		const responses = [
			{ status_code: 1, results: [] },
			{ status_code: 1, results: [] }
		];
		vi.stubGlobal(
			'fetch',
			vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(responses.shift()) }))
		);

		await expect(searchComicVineIssues('zz')).resolves.toEqual([]);
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('maps ComicVine velocity limits to a shared retryable cooldown', async () => {
		mocks.env.VERCEL = '1';
		const fetchMock = vi.fn().mockResolvedValue({
			headers: new Headers({ 'retry-after': '120' }),
			ok: false,
			status: 420
		});
		vi.stubGlobal('fetch', fetchMock);

		await expect(searchComicVineIssues('man')).rejects.toMatchObject({
			message: 'ComicVine is temporarily rate limiting requests. Try again in 120 seconds.',
			retryAfterSeconds: 120,
			status: 429
		});
		await expect(searchComicVineIssues('batman')).rejects.toMatchObject({ status: 429 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(mocks.runtimeCache.set).toHaveBeenCalledWith('cooldown', expect.any(Number), {
			ttl: 120
		});
	});
});
