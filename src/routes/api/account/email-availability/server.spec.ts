import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { verifyInstantToken } from '$lib/server/collection-import';
import { getAdminDb } from '$lib/server/instant-admin';

vi.mock('$lib/server/collection-import', () => ({
	verifyInstantToken: vi.fn()
}));

vi.mock('$lib/server/instant-admin', () => ({
	getAdminDb: vi.fn()
}));

const getUser = vi.fn();

function request(email: unknown = 'reader@example.com', token = 'token') {
	return new Request('http://localhost/api/account/email-availability', {
		method: 'POST',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify({ email })
	});
}

describe('POST /api/account/email-availability', () => {
	beforeEach(() => {
		vi.mocked(verifyInstantToken).mockReset();
		vi.mocked(getAdminDb).mockReset();
		getUser.mockReset();
		vi.mocked(getAdminDb).mockReturnValue({ auth: { getUser } } as never);
	});

	it('requires authentication and a valid email', async () => {
		const unauthorized = await POST({
			request: new Request('http://localhost/api/account/email-availability', {
				method: 'POST'
			})
		} as never);
		expect(unauthorized.status).toBe(401);

		const invalid = await POST({ request: request('invalid') } as never);
		expect(invalid.status).toBe(400);
		expect(verifyInstantToken).not.toHaveBeenCalled();
	});

	it('rejects invalid tokens and registered users', async () => {
		vi.mocked(verifyInstantToken).mockRejectedValueOnce(new Error('Invalid token.'));
		const unauthorized = await POST({ request: request() } as never);
		expect(unauthorized.status).toBe(401);

		vi.mocked(verifyInstantToken).mockResolvedValueOnce({
			id: 'user-1',
			email: 'reader@example.com',
			refresh_token: 'token',
			isGuest: false,
			type: 'user'
		});
		const forbidden = await POST({ request: request() } as never);
		expect(forbidden.status).toBe(403);
		expect(getUser).not.toHaveBeenCalled();
	});

	it('reports whether the email is available to a guest', async () => {
		vi.mocked(verifyInstantToken).mockResolvedValue({
			id: 'guest-1',
			refresh_token: 'token',
			isGuest: true,
			type: 'guest'
		});
		getUser.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'user-2' });

		const available = await POST({ request: request(' New@Example.com ') } as never);
		const unavailable = await POST({ request: request() } as never);

		await expect(available.json()).resolves.toEqual({ available: true });
		await expect(unavailable.json()).resolves.toEqual({ available: false });
		expect(getUser).toHaveBeenNthCalledWith(1, { email: 'new@example.com' });
	});

	it('returns admin failures', async () => {
		vi.mocked(verifyInstantToken).mockResolvedValue({
			id: 'guest-1',
			refresh_token: 'token',
			isGuest: true,
			type: 'guest'
		});
		getUser.mockRejectedValueOnce(new Error('Admin failed.'));

		const response = await POST({ request: request() } as never);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: 'Admin failed.' });
	});
});
