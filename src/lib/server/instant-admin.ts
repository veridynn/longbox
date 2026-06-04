import { env as privateEnv } from '$env/dynamic/private';
import { init } from '@instantdb/admin';
import schema from '../../instant.schema';

function requiredEnv(name: string, value: string | undefined) {
	if (!value) {
		throw new Error(`${name} is not configured.`);
	}

	return value;
}

function createAdminDb() {
	return init({
		appId: requiredEnv('VITE_INSTANT_APP_ID', privateEnv.VITE_INSTANT_APP_ID),
		adminToken: requiredEnv('INSTANT_APP_ADMIN_TOKEN', privateEnv.INSTANT_APP_ADMIN_TOKEN),
		schema,
		useDateObjects: true
	});
}

let adminDb: ReturnType<typeof createAdminDb> | null = null;

export function getAdminDb() {
	adminDb ??= createAdminDb();

	return adminDb;
}
