import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	if (env.LONGBOX_E2E !== '1') error(404, 'Not found');
	if (params.status === '400') error(400, 'E2E error fixture');
	if (params.status === '500') error(500, 'E2E error fixture');
	error(404, 'Not found');
};
