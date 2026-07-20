import { page } from 'vite-plus/test/browser';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { cleanup, render } from 'vitest-browser-svelte';
import { ConfirmDeleteDialog, confirmDelete } from '.';

const navigation = vi.hoisted(() => ({ callbacks: [] as Array<() => void> }));
vi.mock('$app/navigation', () => ({
	onNavigate: (callback: () => void) => navigation.callbacks.push(callback)
}));

describe('ConfirmDeleteDialog', () => {
	afterEach(cleanup);

	it('unmounts its content when navigation starts', async () => {
		render(ConfirmDeleteDialog);
		confirmDelete({
			title: 'Delete list',
			description: 'This action cannot be undone.',
			onConfirm: vi.fn()
		});

		navigation.callbacks.at(-1)?.();

		await expect
			.element(page.getByRole('heading', { name: 'Delete list' }))
			.not.toBeInTheDocument();
	});

	it('requires the configured text before deleting', async () => {
		const onConfirm = vi.fn().mockResolvedValue(undefined);
		render(ConfirmDeleteDialog);
		confirmDelete({
			title: 'Delete list',
			description:
				'This action cannot be undone. Your list will be deleted, but its issues will remain in your collection.',
			input: { confirmationText: 'Favorites' },
			onConfirm
		});

		await expect
			.element(
				page.getByText(
					'This action cannot be undone. Your list will be deleted, but its issues will remain in your collection.'
				)
			)
			.toBeInTheDocument();
		const input = page.getByRole('textbox', { name: 'Type “Favorites” to confirm' });
		const deleteButton = page.getByRole('button', { name: 'Delete' });
		await expect.element(deleteButton).toBeDisabled();

		await input.fill('Favorites');
		await deleteButton.click();

		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it('keeps a failed confirmation open and shows the error', async () => {
		render(ConfirmDeleteDialog);
		confirmDelete({
			title: 'Remove issue?',
			description: 'This will remove the issue.',
			onConfirm: vi.fn().mockRejectedValue(new Error('Unable to remove this issue.'))
		});

		await page.getByRole('button', { name: 'Delete' }).click();

		await expect.element(page.getByRole('alert')).toHaveTextContent('Unable to remove this issue.');
		await expect.element(page.getByRole('heading', { name: 'Remove issue?' })).toBeInTheDocument();
	});
});
