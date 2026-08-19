import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import AccountDialog from './AccountDialog.svelte';

const navigation = vi.hoisted(() => ({ callbacks: [] as Array<() => void> }));
vi.mock('$app/navigation', () => ({
	onNavigate: (callback: () => void) => navigation.callbacks.push(callback)
}));

function renderDialog(overrides: Record<string, unknown> = {}) {
	const onOpenDeleteAccount = vi.fn();

	render(AccountDialog, {
		email: 'reader@example.com',
		isGuest: false,
		onOpenDeleteAccount,
		open: true,
		...overrides
	});

	return { onOpenDeleteAccount };
}

describe('AccountDialog', () => {
	it('unmounts its content when navigation starts', async () => {
		renderDialog();

		navigation.callbacks.at(-1)?.();

		await expect.element(page.getByRole('heading', { name: 'Account' })).not.toBeInTheDocument();
	});

	it('shows a registered user read-only email, close, and deletion trigger', async () => {
		const { onOpenDeleteAccount } = renderDialog();

		await expect
			.element(page.getByLabelText('Email', { exact: true }))
			.toHaveValue('reader@example.com');
		await expect.element(page.getByLabelText('Email', { exact: true })).toHaveAttribute('readonly');
		expect(getComputedStyle(page.getByLabelText('Email', { exact: true }).element()).opacity).toBe(
			'1'
		);
		await expect.element(page.getByText('Delete', { exact: true })).toBeInTheDocument();
		await expect
			.element(page.getByText('Permanently delete my account and all associated data.'))
			.toBeInTheDocument();
		expect(
			[...document.querySelectorAll('button')].some(
				(button) => button.textContent?.trim() === 'Close'
			)
		).toBe(true);

		await page.getByRole('button', { name: 'Delete account' }).click();
		expect(onOpenDeleteAccount).toHaveBeenCalledOnce();
		await expect.element(page.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
	});

	it('focuses the input from its label without a pointer cursor', async () => {
		renderDialog();
		const label = page.getByText('Email', { exact: true });

		expect(getComputedStyle(label.element()).cursor).not.toBe('pointer');
		await label.click();
		expect(document.activeElement).toBe(page.getByLabelText('Email', { exact: true }).element());
	});

	it('hides manual account deletion for guests', async () => {
		renderDialog({ email: null, isGuest: true });

		await expect.element(page.getByText('Delete', { exact: true })).not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Delete account' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Email', { exact: true })).not.toBeInTheDocument();
	});
});
