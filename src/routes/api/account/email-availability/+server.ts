import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyInstantToken } from '$lib/server/collection-import';
import { getAdminDb } from '$lib/server/instant-admin';

function bearerToken(header: string | null) {
	return header?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

export const POST: RequestHandler = async ({ request }) => {
	const token = bearerToken(request.headers.get('authorization'));

	if (!token) {
		return json({ error: 'Authentication is required.' }, { status: 401 });
	}

	let body: { email?: unknown };

	try {
		body = (await request.json()) as { email?: unknown };
	} catch {
		return json({ error: 'Request body must be JSON.' }, { status: 400 });
	}

	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return json({ error: 'Enter a valid email address.' }, { status: 400 });
	}

	let user: Awaited<ReturnType<typeof verifyInstantToken>>;

	try {
		user = await verifyInstantToken(token);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Authentication is invalid.';
		return json({ error: message }, { status: 401 });
	}

	if (!user.isGuest) {
		return json(
			{ error: 'Email availability is only available to guest accounts.' },
			{ status: 403 }
		);
	}

	try {
		const existingUser = await getAdminDb().auth.getUser({ email });
		return json({ available: !existingUser });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to check this email.';
		return json({ error: message }, { status: 500 });
	}
};
