import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import Rename from './rename.svelte';

function pressEnter() {
	document
		.querySelector('input')
		?.dispatchEvent(
			new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' })
		);
}

describe('Rename', () => {
	it('validates and saves an edited value', async () => {
		const onSave = vi.fn();
		render(Rename, {
			this: 'span',
			value: 'To read',
			validate: (value: string) => value.trim().length > 0,
			onSave
		});

		const value = page.getByText('To read', { exact: true });
		await expect.element(value).toHaveClass('cursor-pointer');
		await value.click();
		await page.getByRole('textbox').fill('   ');
		pressEnter();
		expect(onSave).not.toHaveBeenCalled();

		await page.getByRole('textbox').fill('Indie picks');
		pressEnter();
		expect(onSave).toHaveBeenCalledWith('Indie picks');
	});
});
