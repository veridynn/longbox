import { expect, test, type Page } from '@playwright/test';

async function expectErrorPage(
	page: Page,
	{
		status,
		title,
		url
	}: {
		status: number;
		title: string;
		url: string;
	}
) {
	const response = await page.goto(url);

	expect(response?.status()).toBe(status);
	await expect(page.getByRole('heading', { name: title })).toBeVisible();
	await expect(page.getByText(`Error ${status}`)).toBeVisible();
	await expect(page.getByRole('link', { name: 'Collection' })).toHaveAttribute('href', '/');
}

test('shows recovery pages for 400, 404, and 500 errors', async ({ page }) => {
	await expectErrorPage(page, {
		status: 400,
		title: 'We couldn’t open this page',
		url: '/__e2e__/error/400'
	});
	await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);

	await expectErrorPage(page, {
		status: 404,
		title: 'Page not found',
		url: '/this-page-does-not-exist'
	});
	await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);

	await expectErrorPage(page, {
		status: 500,
		title: 'Something went wrong',
		url: '/__e2e__/error/500'
	});
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
