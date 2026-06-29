import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import InlineListTitle from './InlineListTitle.svelte';

function pressInputKey(key: string) {
	document
		.querySelector('input')
		?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
}

describe('InlineListTitle', () => {
	it('saves a valid rename', async () => {
		const onRename = vi.fn();
		render(InlineListTitle, {
			name: 'To read',
			existingNames: ['To read'],
			onRename
		});

		await page.getByRole('button', { name: /To read/ }).click();
		await page.getByRole('textbox').fill('Indie picks');
		pressInputKey('Enter');

		expect(onRename).toHaveBeenCalledWith('Indie picks');
	});

	it('rejects blank, reserved, and duplicate names', async () => {
		const onRename = vi.fn();
		render(InlineListTitle, {
			name: 'To read',
			existingNames: ['To read', 'Indie picks'],
			onRename
		});

		await page.getByRole('button', { name: /To read/ }).click();
		await page.getByRole('textbox').fill('   ');
		pressInputKey('Enter');
		await expect.element(page.getByText('Enter a list name.')).toBeInTheDocument();

		await page.getByRole('textbox').fill('Collection');
		pressInputKey('Enter');
		await expect
			.element(page.getByText('A list with this name already exists.'))
			.toBeInTheDocument();

		await page.getByRole('textbox').fill('indie PICKS');
		pressInputKey('Enter');
		await expect
			.element(page.getByText('A list with this name already exists.'))
			.toBeInTheDocument();
		expect(onRename).not.toHaveBeenCalled();
	});

	it('cancels with Escape', async () => {
		const onRename = vi.fn();
		render(InlineListTitle, {
			name: 'To read',
			existingNames: ['To read'],
			onRename
		});

		await page.getByRole('button', { name: /To read/ }).click();
		await page.getByRole('textbox').fill('Changed');
		pressInputKey('Escape');

		expect(onRename).not.toHaveBeenCalled();
		await expect.element(page.getByRole('button', { name: /To read/ })).toBeInTheDocument();
	});
});
