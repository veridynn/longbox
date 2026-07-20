import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyInstantToken } from '$lib/server/collection-import';
import { getAdminDb } from '$lib/server/instant-admin';

function bearerToken(header: string | null) {
	return header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export const DELETE: RequestHandler = async ({ request }) => {
	const token = bearerToken(request.headers.get('authorization'));

	if (!token) {
		return json({ error: 'Authentication is required.' }, { status: 401 });
	}

	let body: { email?: unknown; confirmation?: unknown };

	try {
		body = (await request.json()) as { email?: unknown; confirmation?: unknown };
	} catch {
		return json({ error: 'Request body must be JSON.' }, { status: 400 });
	}

	let user: Awaited<ReturnType<typeof verifyInstantToken>>;

	try {
		user = await verifyInstantToken(token);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Authentication is invalid.';
		return json({ error: message }, { status: 401 });
	}

	if (user.isGuest) {
		return json({ error: 'Guest accounts cannot be deleted manually.' }, { status: 403 });
	}

	if (typeof body.email !== 'string' || typeof body.confirmation !== 'string') {
		return json({ error: 'Email and confirmation are required.' }, { status: 400 });
	}

	if (body.email !== user.email || body.confirmation !== 'delete my account') {
		return json({ error: 'Account confirmation does not match.' }, { status: 400 });
	}

	try {
		const adminDb = getAdminDb();
		const avatarPath = `${user.id}/profile/avatar`;
		const avatarQuery = await adminDb.query({
			$files: {
				$: {
					where: { path: avatarPath }
				}
			}
		});
		const avatar = avatarQuery.$files[0];

		if (avatar) {
			await adminDb.transact(adminDb.tx.$files[avatar.id].delete());
		}

		const deletedUser = await adminDb.auth.deleteUser({ id: user.id });

		if (!deletedUser) {
			return json({ error: 'Unable to delete this account.' }, { status: 500 });
		}

		return new Response(null, { status: 204 });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to delete this account.';
		return json({ error: message }, { status: 500 });
	}
};
