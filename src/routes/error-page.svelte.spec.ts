import { page } from 'vite-plus/test/browser';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render } from 'vitest-browser-svelte';
import './layout.css';

const appPage = vi.hoisted(() => ({ status: 404 }));

vi.mock('$app/state', () => ({ page: appPage }));

import ErrorPage from './+error.svelte';

afterEach(cleanup);

describe('error page', () => {
	it.each([
		{
			description: 'The request was not valid. Return to your collection and try again.',
			status: 400,
			title: 'We couldn’t open this page'
		},
		{
			description: 'The page may have moved, been deleted, or never existed.',
			status: 404,
			title: 'Page not found'
		},
		{
			description: 'Longbox couldn’t load this page. Try again in a moment.',
			status: 500,
			title: 'Something went wrong'
		}
	])('renders recovery for $status', async ({ description, status, title }) => {
		appPage.status = status;
		render(ErrorPage);

		await expect.element(page.getByRole('heading', { name: title })).toBeInTheDocument();
		await expect.element(page.getByText(description)).toBeInTheDocument();
		await expect
			.element(page.getByRole('link', { name: 'Collection' }))
			.toHaveAttribute('href', '/');

		if (status >= 500) {
			await expect.element(page.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
		} else {
			expect(page.getByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
		}
	});
});
