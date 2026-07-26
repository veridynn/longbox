import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.goto('/__e2e__/states');
});

test('covers collection and list empty states', async ({ page }) => {
	await expect(page.getByRole('heading', { name: 'Your collection is empty' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add first issue' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Create your first list' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create list', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'This list is empty' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add issues' })).toBeVisible();
});

test('covers panel error alerts', async ({ page }) => {
	await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t load lists' })).toBeVisible();
	await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t load issues' })).toBeVisible();
	await expect(
		page.getByRole('alert').filter({ hasText: 'Couldn’t update this list' })
	).toBeVisible();
	await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t save changes' })).toBeVisible();
});

test('covers initial, empty, and failed search states', async ({ page }) => {
	await page.getByRole('button', { name: 'Open initial state' }).click();
	await expect(page.getByRole('dialog')).toContainText('Search comics');
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: 'Open no-results state' }).click();
	await expect(page.getByRole('dialog')).toContainText('No matching runs found');
	await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible();
	await page.keyboard.press('Escape');

	await page.getByRole('button', { name: 'Open error state' }).click();
	const searchAlert = page.getByRole('alert').filter({ hasText: 'Search failed' });
	await expect(searchAlert).toContainText('Unable to search. Try again.');
	await expect(searchAlert.getByRole('button', { name: 'Retry' })).toBeVisible();
});
