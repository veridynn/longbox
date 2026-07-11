import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import AppHeader from './AppHeader.svelte';

function renderHeader(isGuest: boolean) {
	const onSaveAccount = vi.fn();
	const onSignOut = vi.fn();

	render(AppHeader, {
		isGuest,
		onSaveAccount,
		onSignOut,
		signedIn: true
	});

	return { onSaveAccount, onSignOut };
}

describe('AppHeader account menu', () => {
	it('shows guest actions and calls their handlers', async () => {
		const { onSaveAccount, onSignOut } = renderHeader(true);

		await page.getByRole('button', { name: 'Open account menu' }).click();
		await page.getByRole('menuitem', { name: 'Save account' }).click();
		expect(onSaveAccount).toHaveBeenCalledOnce();

		await page.getByRole('button', { name: 'Open account menu' }).click();
		await page.getByRole('menuitem', { name: 'Sign out' }).click();
		expect(onSignOut).toHaveBeenCalledOnce();
	});

	it('only offers sign out to registered users', async () => {
		renderHeader(false);

		const trigger = page.getByRole('button', { name: 'Open account menu' });
		await expect.element(trigger).toBeInTheDocument();
		const triggerElement = trigger.element() as HTMLButtonElement;
		triggerElement.focus();
		triggerElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

		await expect.element(page.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: 'Save account' }))
			.not.toBeInTheDocument();
	});
});
