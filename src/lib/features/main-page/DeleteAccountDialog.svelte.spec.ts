import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import '../../../routes/layout.css';
import DeleteAccountDialog from './DeleteAccountDialog.svelte';

const navigation = vi.hoisted(() => ({ callbacks: [] as Array<() => void> }));
vi.mock('$app/navigation', () => ({
	onNavigate: (callback: () => void) => navigation.callbacks.push(callback)
}));

function renderDialog(overrides: Record<string, unknown> = {}) {
	const onCancel = vi.fn();
	const onDeleteAccount = vi.fn();

	render(DeleteAccountDialog, {
		email: 'reader@example.com',
		errorMessage: null,
		isDeleting: false,
		onCancel,
		onDeleteAccount,
		open: true,
		...overrides
	});

	return { onCancel, onDeleteAccount };
}

describe('DeleteAccountDialog', () => {
	it('shows the permanent warning and both confirmations', async () => {
		renderDialog();

		await expect
			.element(page.getByText('Your account will be deleted immediately. This cannot be undone.'))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Close' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
		await expect
			.element(page.getByLabelText('Enter reader@example.com to continue'))
			.toBeInTheDocument();
		await expect
			.element(page.getByLabelText('Type delete my account to confirm'))
			.toBeInTheDocument();
	});

	it('requires exact values before deletion', async () => {
		const { onDeleteAccount } = renderDialog();
		const deleteButton = page.getByRole('button', { name: 'Permanently delete account' });

		await page.getByLabelText('Enter reader@example.com to continue').fill('reader@example.com');
		await page.getByLabelText('Type delete my account to confirm').fill('DELETE MY ACCOUNT');
		await expect.element(deleteButton).toBeDisabled();
		await page.getByLabelText('Type delete my account to confirm').fill('delete my account');
		await expect.element(deleteButton).toBeEnabled();
		await deleteButton.click();

		expect(onDeleteAccount).toHaveBeenCalledWith('reader@example.com', 'delete my account');
	});

	it('keeps errors inside the dialog and closes from the X without deleting', async () => {
		const { onCancel, onDeleteAccount } = renderDialog({ errorMessage: 'Deletion failed.' });

		await expect.element(page.getByText('Deletion failed.')).toBeInTheDocument();
		await page.getByRole('button', { name: 'Close' }).click();

		expect(onCancel).toHaveBeenCalledOnce();
		expect(onDeleteAccount).not.toHaveBeenCalled();
	});

	it('cancels when clicking outside', async () => {
		const { onCancel, onDeleteAccount } = renderDialog();
		const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!;

		await new Promise((resolve) => setTimeout(resolve, 20));
		overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));

		await expect
			.element(page.getByRole('heading', { name: 'Delete account' }))
			.not.toBeInTheDocument();
		expect(onCancel).toHaveBeenCalledOnce();
		expect(onDeleteAccount).not.toHaveBeenCalled();
	});

	it('unmounts when navigation starts', async () => {
		renderDialog();

		navigation.callbacks.at(-1)?.();

		await expect
			.element(page.getByRole('heading', { name: 'Delete account' }))
			.not.toBeInTheDocument();
	});
});
