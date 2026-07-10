import { page } from 'vite-plus/test/browser';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render } from 'vitest-browser-svelte';
import { ConfirmDeleteDialog, confirmDelete } from '.';

describe('ConfirmDeleteDialog', () => {
	afterEach(cleanup);

	it('requires the configured text before deleting', async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		render(ConfirmDeleteDialog);
		confirmDelete({
			title: 'Delete',
			description: 'Are you sure you want to delete Favorites?',
			input: { confirmationText: 'Favorites' },
			onConfirm
		});

		await expect
			.element(page.getByText('Are you sure you want to delete Favorites?'))
			.toBeInTheDocument();
		const input = page.getByPlaceholder('Enter "Favorites" to confirm.');
		const deleteButton = page.getByRole('button', { name: 'Delete' });
		await expect.element(deleteButton).toBeDisabled();

		await input.fill('Favorites');
		await deleteButton.click();

		expect(onConfirm).toHaveBeenCalledOnce();
	});
});
