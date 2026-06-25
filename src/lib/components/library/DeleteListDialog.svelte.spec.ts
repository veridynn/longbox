import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import DeleteListDialog from './DeleteListDialog.svelte';

describe('DeleteListDialog', () => {
	it('requires the exact list name before deleting', async () => {
		const onConfirm = vi.fn();
		render(DeleteListDialog, {
			errorMessage: null,
			isSubmitting: false,
			listName: 'To read',
			onCancel: vi.fn(),
			onConfirm,
			open: true
		});

		await expect.element(page.getByRole('button', { name: 'Delete list' })).toBeDisabled();
		await page.getByRole('textbox', { name: 'List name' }).fill('to read');
		await expect.element(page.getByRole('button', { name: 'Delete list' })).toBeDisabled();
		await page.getByRole('textbox', { name: 'List name' }).fill('To read');
		await page.getByRole('button', { name: 'Delete list' }).click();

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it('shows transaction errors', async () => {
		render(DeleteListDialog, {
			errorMessage: 'Unable to delete this list.',
			isSubmitting: false,
			listName: 'To read',
			onCancel: vi.fn(),
			onConfirm: vi.fn(),
			open: true
		});

		await expect.element(page.getByText('Unable to delete this list.')).toBeInTheDocument();
	});
});
