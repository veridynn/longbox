import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getComicVineIssue, getComicVineVolume } from '$lib/server/comicvine';
import { getAdminDb } from '$lib/server/instant-admin';
import { importComicVineIssue } from './collection-import';

vi.mock('$lib/server/comicvine', () => ({
	getComicVineIssue: vi.fn(),
	getComicVineVolume: vi.fn()
}));

vi.mock('$lib/server/instant-admin', () => ({
	getAdminDb: vi.fn()
}));

function createTxNamespace(
	namespace: string,
	updates: Array<{ namespace: string; payload: unknown }>
) {
	return new Proxy(
		{},
		{
			get: (_target, id) => ({
				update: (payload: unknown) => {
					updates.push({ namespace, payload });

					return {
						id,
						namespace,
						payload,
						link: (links: unknown) => ({ id, namespace, payload, links })
					};
				}
			})
		}
	);
}

function createAdminDb(query: (queryShape: Record<string, unknown>) => unknown) {
	const updates: Array<{ namespace: string; payload: unknown }> = [];
	const txNamespaces = [
		'characters',
		'issueCharacters',
		'issueCredits',
		'issues',
		'people',
		'publishers',
		'userIssues',
		'userListItems',
		'userLists',
		'volumes'
	];

	return {
		updates,
		db: {
			auth: { verifyToken: vi.fn() },
			query: vi.fn(query),
			transact: vi.fn(),
			tx: Object.fromEntries(
				txNamespaces.map((namespace) => [namespace, createTxNamespace(namespace, updates)])
			)
		}
	};
}

const comicVineIssue = {
	id: 123,
	name: 'The Bat',
	issueNumber: '1',
	coverDate: '1990-04-01',
	storeDate: null,
	coverImageUrl: 'https://img.example/issue.jpg',
	descriptionHtml: null,
	summary: null,
	volume: { id: 456, name: 'The Bat' },
	characters: [],
	credits: [],
	raw: { id: 123 }
};

const comicVineVolume = {
	id: 456,
	name: 'The Bat',
	startYear: '1990',
	status: null,
	summary: null,
	issueCount: 1,
	coverImageUrl: null,
	publisher: { id: 10, name: 'A Publisher' },
	raw: { id: 456 }
};

describe('importComicVineIssue', () => {
	beforeEach(() => {
		vi.mocked(getAdminDb).mockReset();
		vi.mocked(getComicVineIssue).mockReset();
		vi.mocked(getComicVineVolume).mockReset();
	});

	it('short-circuits duplicate collection adds before fetching ComicVine', async () => {
		const { db } = createAdminDb((queryShape) => {
			if ('userIssues' in queryShape) {
				return { userIssues: [{ id: 'existing-user-issue' }] };
			}

			return {};
		});

		vi.mocked(getAdminDb).mockReturnValue(db as never);

		await expect(importComicVineIssue('user-1', 123)).resolves.toEqual({
			alreadyInCollection: true,
			issueId: '123',
			userIssueKey: 'user-1:comicvine:123'
		});

		expect(getComicVineIssue).not.toHaveBeenCalled();
		expect(getComicVineVolume).not.toHaveBeenCalled();
		expect(db.transact).not.toHaveBeenCalled();
	});

	it('adds an existing collection issue to a custom list without re-importing it', async () => {
		const { db, updates } = createAdminDb((queryShape) => {
			if ('userLists' in queryShape) {
				return {
					userLists: [
						{
							id: 'list-1',
							items: [],
							listKey: 'user-1:custom:list-1',
							name: 'Pull list'
						}
					]
				};
			}

			if ('userIssues' in queryShape) {
				return { userIssues: [{ id: 'existing-user-issue' }] };
			}

			if ('userListItems' in queryShape) {
				return { userListItems: [] };
			}

			return {};
		});

		vi.mocked(getAdminDb).mockReturnValue(db as never);

		await expect(importComicVineIssue('user-1', 123, 'list-1')).resolves.toEqual({
			alreadyInCollection: true,
			issueId: '123',
			userIssueKey: 'user-1:comicvine:123'
		});

		expect(getComicVineIssue).not.toHaveBeenCalled();
		expect(getComicVineVolume).not.toHaveBeenCalled();
		expect(updates).toEqual([
			{
				namespace: 'userListItems',
				payload: {
					addedAt: expect.any(Date),
					listItemKey: 'user-1:custom:list-1:userIssue:user-1:comicvine:123',
					position: 0
				}
			}
		]);
		expect(db.transact).toHaveBeenCalledOnce();
	});

	it('creates an owned collection issue on first import', async () => {
		const { db, updates } = createAdminDb((queryShape) => {
			if ('userIssues' in queryShape) {
				return { userIssues: [] };
			}

			return {};
		});

		vi.mocked(getAdminDb).mockReturnValue(db as never);
		vi.mocked(getComicVineIssue).mockResolvedValue(comicVineIssue);
		vi.mocked(getComicVineVolume).mockResolvedValue(comicVineVolume);

		await expect(importComicVineIssue('user-1', 123)).resolves.toMatchObject({
			alreadyInCollection: false,
			issueId: '123'
		});

		const userIssueUpdate = updates.find((update) => update.namespace === 'userIssues');

		expect(userIssueUpdate?.payload).toEqual({
			createdAt: expect.any(Date),
			favorite: false,
			owned: true,
			readStatus: 'unread',
			updatedAt: expect.any(Date)
		});
		expect(userIssueUpdate?.payload).not.toHaveProperty('rating');
		expect(db.transact).toHaveBeenCalledOnce();
	});
});
