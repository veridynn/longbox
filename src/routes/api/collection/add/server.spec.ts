import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { importComicVineIssue, verifyInstantToken } from '$lib/server/collection-import';

vi.mock('$lib/server/collection-import', () => ({
	importComicVineIssue: vi.fn(),
	verifyInstantToken: vi.fn()
}));

describe('POST /api/collection/add', () => {
	beforeEach(() => {
		vi.mocked(importComicVineIssue).mockReset();
		vi.mocked(verifyInstantToken).mockReset();
	});

	it('requires authentication', async () => {
		const response = await POST({
			request: new Request('http://localhost/api/collection/add', {
				method: 'POST',
				body: JSON.stringify({ issueId: 123 })
			})
		} as never);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({ error: 'Authentication is required.' });
	});

	it('requires a valid ComicVine issue id', async () => {
		const response = await POST({
			request: new Request('http://localhost/api/collection/add', {
				method: 'POST',
				headers: { authorization: 'Bearer token' },
				body: JSON.stringify({ issueId: 'bad' })
			})
		} as never);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: 'A valid ComicVine issue id is required.'
		});
	});

	it('imports an issue for the verified user', async () => {
		vi.mocked(verifyInstantToken).mockResolvedValue({
			id: 'user-1',
			refresh_token: 'token',
			isGuest: true,
			type: 'guest'
		});
		vi.mocked(importComicVineIssue).mockResolvedValue({
			alreadyInCollection: false,
			issueId: '123',
			userIssueKey: 'user-1:comicvine:123'
		});

		const response = await POST({
			request: new Request('http://localhost/api/collection/add', {
				method: 'POST',
				headers: {
					authorization: 'Bearer token',
					'content-type': 'application/json'
				},
				body: JSON.stringify({ issueId: 123 })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(verifyInstantToken).toHaveBeenCalledWith('token');
		expect(importComicVineIssue).toHaveBeenCalledWith('user-1', 123, null);
		await expect(response.json()).resolves.toEqual({
			imported: {
				alreadyInCollection: false,
				issueId: '123',
				userIssueKey: 'user-1:comicvine:123'
			}
		});
	});

	it('passes an optional target list id', async () => {
		vi.mocked(verifyInstantToken).mockResolvedValue({
			id: 'user-1',
			refresh_token: 'token',
			isGuest: true,
			type: 'guest'
		});
		vi.mocked(importComicVineIssue).mockResolvedValue({
			alreadyInCollection: false,
			issueId: '123',
			userIssueKey: 'user-1:comicvine:123'
		});

		const response = await POST({
			request: new Request('http://localhost/api/collection/add', {
				method: 'POST',
				headers: {
					authorization: 'Bearer token',
					'content-type': 'application/json'
				},
				body: JSON.stringify({ issueId: 123, listId: 'list-1' })
			})
		} as never);

		expect(response.status).toBe(200);
		expect(importComicVineIssue).toHaveBeenCalledWith('user-1', 123, 'list-1');
	});
});
