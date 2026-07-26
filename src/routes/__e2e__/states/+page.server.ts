import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (env.LONGBOX_E2E !== '1') error(404, 'Not found');
};
