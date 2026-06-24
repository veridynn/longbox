import { page } from 'vite-plus/test/browser';
import { describe, expect, it, vi } from 'vite-plus/test';
import { render } from 'vitest-browser-svelte';
import ListsPanel from './ListsPanel.svelte';

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
					id: 'one',
					issueCount: 1,
					name: 'To read'
				},
				{ coverImageUrls: [], id: 'two', issueCount: 0, name: 'Indie picks' }
			],
			onCreateList: vi.fn()
		});

		const headings = Array.from(document.querySelectorAll('h3')).map((heading) =>
			heading.textContent?.trim()
		);
		expect(headings).toEqual(['To read', 'Indie picks', 'Create new list']);
		expect(document.body.textContent).toContain('1 issue');
		expect(document.querySelectorAll('a[href="/list/one"] img')).toHaveLength(5);
	});

	it('opens list creation from the card and keyboard shortcut', async () => {
		const onCreateList = vi.fn();
		render(ListsPanel, {
			customLists: [],
			onCreateList
		});

		await page.getByRole('button', { name: /Create new list/ }).click();
		expect(onCreateList).toHaveBeenCalledTimes(1);

		document.dispatchEvent(
			new KeyboardEvent('keydown', { bubbles: true, ctrlKey: true, key: 'L' })
		);
		expect(onCreateList).toHaveBeenCalledTimes(2);
	});
});
