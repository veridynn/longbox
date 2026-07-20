import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import AppHeader from './AppHeader.svelte';

function renderHeader(isGuest: boolean, overrides: Record<string, unknown> = {}) {
	const onOpenAccount = vi.fn();
	const onOpenProfile = vi.fn();
	const onSaveAccount = vi.fn();
	const onSignOut = vi.fn();

	const props = {
		isGuest,
		onOpenAccount,
		onOpenProfile,
		onSaveAccount,
		onSignOut,
		profileImageSrc: 'https://example.com/avatar.jpg',
		profileName: 'Comic Reader',
		signedIn: true,
		...overrides
	};
	const view = render(AppHeader, props);

	return { onOpenAccount, onOpenProfile, onSaveAccount, onSignOut, props, view };
}

describe('AppHeader account menu', () => {
	it('keeps the brand static and starts keyboard focus at the profile menu', () => {
		renderHeader(false);

		const header = page.getByRole('banner').element();
		const logo = header.querySelector('img');
		expect(logo?.getAttribute('src')).toContain('longbox-logo');
		expect(logo?.getAttribute('alt')).toBe('');
		expect(header.querySelector('a')).toBeNull();
		expect(
			header.querySelector('a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])')
		).toBe(page.getByRole('button', { name: 'Open account menu' }).element());
	});

	it('shows guest actions and calls their handlers', async () => {
		const { onOpenAccount, onOpenProfile, onSaveAccount, onSignOut } = renderHeader(true);

		await page.getByRole('button', { name: 'Open account menu' }).click();
		await page.getByRole('menuitem', { name: 'Profile', exact: true }).click();
		expect(onOpenProfile).toHaveBeenCalledOnce();

		await page.getByRole('button', { name: 'Open account menu' }).click();
		await page.getByRole('menuitem', { name: 'Account', exact: true }).click();
		expect(onOpenAccount).toHaveBeenCalledOnce();

		await page.getByRole('button', { name: 'Open account menu' }).click();
		await page.getByRole('menuitem', { name: 'Save account' }).click();
		expect(onSaveAccount).toHaveBeenCalledOnce();

		await page.getByRole('button', { name: 'Open account menu' }).click();
		await page.getByRole('menuitem', { name: 'Sign out' }).click();
		expect(onSignOut).toHaveBeenCalledOnce();
	});

	it('shows the profile identity and registered-user actions', async () => {
		renderHeader(false);

		const trigger = page.getByRole('button', { name: 'Open account menu' });
		await expect.element(trigger).toBeInTheDocument();
		const triggerElement = trigger.element() as HTMLButtonElement;
		expect(getComputedStyle(triggerElement).cursor).toBe('pointer');
		triggerElement.focus();
		triggerElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));

		await expect.element(page.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: 'Profile', exact: true }))
			.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: 'Account', exact: true }))
			.toBeInTheDocument();
		expect(
			getComputedStyle(page.getByRole('menuitem', { name: 'Profile', exact: true }).element())
				.cursor
		).toBe('pointer');
		await expect.element(page.getByText('reader@example.com')).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('menuitem', { name: 'Save account' }))
			.not.toBeInTheDocument();
	});

	it('renders the saved profile picture', async () => {
		renderHeader(false);

		const trigger = page.getByRole('button', { name: 'Open account menu' }).element();
		const avatar = trigger.querySelector('img');
		expect(avatar?.getAttribute('alt')).toBe('Comic Reader');
		expect(avatar?.getAttribute('src')).toBe('https://example.com/avatar.jpg');
	});

	it('keeps the avatar visible through preview, cancel, and saved-image handoffs', async () => {
		const oldImage =
			'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
		const previewImage = `${oldImage}%3C!--preview--%3E`;
		const savedImage = `${oldImage}%3C!--saved--%3E`;
		const { props, view } = renderHeader(false, { profileImageSrc: oldImage });
		const trigger = page.getByRole('button', { name: 'Open account menu' }).element();
		const avatar = trigger.querySelector<HTMLElement>('[data-slot="avatar"]')!;

		await expect.element(avatar).toHaveAttribute('data-status', 'loaded');
		await view.rerender({ ...props, profileImageSrc: previewImage });

		expect(trigger.querySelector('[data-slot="avatar"]')).toBe(avatar);
		expect(trigger.querySelector<HTMLImageElement>('[data-slot="avatar-image"]')?.src).toBe(
			previewImage
		);
		expect(
			getComputedStyle(trigger.querySelector<HTMLElement>('[data-slot="avatar-fallback"]')!).display
		).toBe('none');

		await view.rerender({ ...props, profileImageSrc: oldImage });
		expect(trigger.querySelector<HTMLImageElement>('[data-slot="avatar-image"]')?.src).toBe(
			oldImage
		);
		expect(trigger.querySelector('[data-slot="avatar"]')).toBe(avatar);

		await view.rerender({ ...props, profileImageSrc: previewImage });
		await view.rerender({ ...props, profileImageSrc: savedImage });
		expect(trigger.querySelector<HTMLImageElement>('[data-slot="avatar-image"]')?.src).toBe(
			savedImage
		);
		expect(trigger.querySelector('[data-slot="avatar"]')).toBe(avatar);

		await view.rerender({ ...props, profileImageSrc: '' });
		expect(trigger.querySelector('[data-slot="avatar"]')).not.toBe(avatar);
		expect(trigger.querySelector<HTMLImageElement>('img')?.alt).toBe('Longbox logo');
	});

	it('uses the grayscale Longbox logo when no profile picture exists', async () => {
		renderHeader(false, { profileImageSrc: '' });

		const logo = page
			.getByRole('button', { name: 'Open account menu' })
			.element()
			.querySelector('img');
		expect(logo?.getAttribute('alt')).toBe('Longbox logo');
		expect(logo).toHaveClass('rounded-full', 'grayscale', 'opacity-50');
	});
});
