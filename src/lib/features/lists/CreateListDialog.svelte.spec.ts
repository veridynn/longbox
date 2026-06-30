import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import CreateListDialog from './CreateListDialog.svelte';

describe('CreateListDialog', () => {
	it('submits the entered name', async () => {
		const onSubmit = vi.fn();
		render(CreateListDialog, {
			errorMessage: null,
			isSubmitting: false,
			name: '',
			onCancel: vi.fn(),
			onSubmit,
			open: true
		});

		await page.getByLabelText('List name').fill('Reading queue');
		await page.getByRole('button', { name: 'Create list' }).click();
		expect(onSubmit).toHaveBeenCalledOnce();
	});

	it('shows errors and disables actions while submitting', async () => {
		render(CreateListDialog, {
			errorMessage: 'A list with this name already exists.',
			isSubmitting: true,
			name: 'Favorites',
			onCancel: vi.fn(),
			onSubmit: vi.fn(),
			open: true
		});

		await expect
			.element(page.getByText('A list with this name already exists.'))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Create list' })).toBeDisabled();
	});
});
