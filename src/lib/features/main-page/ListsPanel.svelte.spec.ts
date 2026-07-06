import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import ListsPanel from './ListsPanel.svelte';

function pressInputKey(key: string) {
	document
		.querySelector('input')
		?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
}

describe('ListsPanel', () => {
	it('renders custom lists in order with issue counts', async () => {
		render(ListsPanel, {
			customLists: [
				{
					coverImageUrls: [
						'https://img.example/one.jpg',
						'https://img.example/two.jpg',
						'https://img.example/three.jpg',
						'https://img.example/four.jpg',
						'https://img.example/five.jpg'
					],
					createdAt: new Date('2024-01-01T00:00:00.000Z'),
					id: 'one',
					issueCount: 1,
					name: 'To read',
					updatedAt: new Date('2024-01-01T00:00:00.000Z')
				},
				{
					coverImageUrls: [],
					createdAt: new Date('2024-01-02T00:00:00.000Z'),
					id: 'two',
					issueCount: 0,
					name: 'Indie picks',
					updatedAt: new Date('2024-01-02T00:00:00.000Z')
				}
			],
			onCreateList: vi.fn(),
			onRenameList: vi.fn()
		});

		expect(document.body.textContent).toContain('To read');
		expect(document.body.textContent).toContain('Indie picks');
		expect(document.body.textContent).toContain('1 issue');
		await expect
			.element(page.getByRole('link', { name: '1 issue' }))
			.toHaveAttribute('href', '/list/one');
		await expect
			.element(page.getByRole('link', { name: '0 issues' }))
			.toHaveAttribute('href', '/list/two');
		expect(document.querySelectorAll('a[href="/list/one"] img')).toHaveLength(5);
		expect(document.querySelectorAll('a[href="/list/two"] [aria-hidden="true"]')).toHaveLength(5);
		expect(page.getByLabelText('View mode')).not.toBeInTheDocument();
		expect(page.getByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
	});

	it('opens list creation from the header button and keyboard shortcut', async () => {
		const onCreateList = vi.fn();
		render(ListsPanel, {
			customLists: [],
			onCreateList,
			onRenameList: vi.fn()
		});

		await page.getByRole('button', { name: /Create list/ }).click();
		expect(onCreateList).toHaveBeenCalledTimes(1);

		document.dispatchEvent(
			new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'L' })
		);
		expect(onCreateList).toHaveBeenCalledTimes(2);
	});

	it('renames a custom list', async () => {
		const onRenameList = vi.fn();
		render(ListsPanel, {
			customLists: [
				{
					coverImageUrls: [],
					createdAt: new Date('2024-01-01T00:00:00.000Z'),
					id: 'one',
					issueCount: 0,
					name: 'To read',
					updatedAt: new Date('2024-01-01T00:00:00.000Z')
				}
			],
			onCreateList: vi.fn(),
			onRenameList
		});

		(
			Array.from(document.querySelectorAll('button')).find(
				(button) => button.textContent?.trim() === 'To read'
			) as HTMLButtonElement
		).click();
		await page.getByRole('textbox').fill('Indie picks');
		pressInputKey('Enter');
		expect(onRenameList).toHaveBeenCalledWith('one', 'Indie picks');
	});
});
