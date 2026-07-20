import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './+server';
import { verifyInstantToken } from '$lib/server/collection-import';
import { getAdminDb } from '$lib/server/instant-admin';

vi.mock('$lib/server/collection-import', () => ({
	verifyInstantToken: vi.fn()
}));

vi.mock('$lib/server/instant-admin', () => ({
	getAdminDb: vi.fn()
}));

const deleteUser = vi.fn();
const deleteAvatar = vi.fn(() => 'delete-avatar-transaction');
const query = vi.fn();
const transact = vi.fn();

function request(
	email: unknown = 'reader@example.com',
	confirmation: unknown = 'delete my account',
	token = 'token'
) {
	return new Request('http://localhost/api/account', {
		method: 'DELETE',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({ email, confirmation })
	});
}

describe('DELETE /api/account', () => {
	beforeEach(() => {
		vi.mocked(verifyInstantToken).mockReset();
		vi.mocked(getAdminDb).mockReset();
		deleteUser.mockReset();
		deleteAvatar.mockClear();
		query.mockReset().mockResolvedValue({ $files: [] });
		transact.mockReset().mockResolvedValue(undefined);
		vi.mocked(getAdminDb).mockReturnValue({
			auth: { deleteUser },
			query,
			transact,
			tx: { $files: { 'avatar-1': { delete: deleteAvatar } } }
		} as never);
	});

	it('requires authentication', async () => {
		const response = await DELETE({
			request: new Request('http://localhost/api/account', { method: 'DELETE' })
		} as never);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({ error: 'Authentication is required.' });
	});

	it('rejects malformed JSON', async () => {
		const response = await DELETE({
			request: new Request('http://localhost/api/account', {
				method: 'DELETE',
				headers: { authorization: 'Bearer token' },
				body: '{'
			})
		} as never);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({ error: 'Request body must be JSON.' });
	});

	it('requires the verified account confirmation', async () => {
		vi.mocked(verifyInstantToken).mockResolvedValue({
			id: 'user-1',
			email: 'reader@example.com',
			refresh_token: 'token',
			isGuest: false,
			type: 'user'
		});

		const response = await DELETE({ request: request('wrong@example.com') } as never);

		expect(response.status).toBe(400);
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it('deletes the verified user', async () => {
		const user = {
			id: 'user-1',
			email: 'reader@example.com',
			refresh_token: 'token',
			isGuest: false,
			type: 'user' as const
		};
		vi.mocked(verifyInstantToken).mockResolvedValue(user);
		deleteUser.mockResolvedValue(user);
		query.mockResolvedValue({ $files: [{ id: 'avatar-1' }] });

		const response = await DELETE({ request: request() } as never);

		expect(response.status).toBe(204);
		expect(query).toHaveBeenCalledWith({
			$files: { $: { where: { path: 'user-1/profile/avatar' } } }
		});
		expect(deleteAvatar).toHaveBeenCalledOnce();
		expect(transact).toHaveBeenCalledWith('delete-avatar-transaction');
		expect(transact.mock.invocationCallOrder[0]).toBeLessThan(
			deleteUser.mock.invocationCallOrder[0]
		);
		expect(deleteUser).toHaveBeenCalledWith({ id: 'user-1' });
	});

	it('rejects guest deletion', async () => {
		const user = {
			id: 'guest-1',
			refresh_token: 'token',
			isGuest: true,
			type: 'guest' as const
		};
		vi.mocked(verifyInstantToken).mockResolvedValue(user);
		const response = await DELETE({ request: request('', 'delete my account') } as never);

		expect(response.status).toBe(403);
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it('requires both confirmation values', async () => {
		vi.mocked(verifyInstantToken).mockResolvedValue({
			id: 'user-1',
			email: 'reader@example.com',
			refresh_token: 'token',
			isGuest: false,
			type: 'user'
		});

		const missingEmail = await DELETE({
			request: new Request('http://localhost/api/account', {
				method: 'DELETE',
				headers: {
					authorization: 'Bearer token',
					'content-type': 'application/json'
				},
				body: JSON.stringify({ confirmation: 'delete my account' })
			})
		} as never);
		const wrongPhrase = await DELETE({ request: request(undefined, 'DELETE') } as never);

		expect(missingEmail.status).toBe(400);
		expect(wrongPhrase.status).toBe(400);
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it('returns authentication and deletion failures', async () => {
		vi.mocked(verifyInstantToken).mockRejectedValueOnce(new Error('Invalid token.'));

		const unauthorized = await DELETE({ request: request() } as never);
		expect(unauthorized.status).toBe(401);

		vi.mocked(verifyInstantToken).mockResolvedValue({
			id: 'user-1',
			email: 'reader@example.com',
			refresh_token: 'token',
			isGuest: false,
			type: 'user'
		});
		deleteUser.mockRejectedValueOnce(new Error('Delete failed.'));

		const failed = await DELETE({ request: request() } as never);
		expect(failed.status).toBe(500);
		await expect(failed.json()).resolves.toEqual({ error: 'Delete failed.' });
	});
});
