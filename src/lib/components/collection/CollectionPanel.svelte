<script lang="ts">
	import { Search } from '@lucide/svelte';
	import IssueListPanel, { type IssueListViewMode } from './IssueListPanel.svelte';
	import type { CollectionItem } from '$lib/comics/types';

	type Props = {
		errorMessage: string | null;
		isLoading: boolean;
		items: CollectionItem[];
		onReorderItems?: (items: CollectionItem[]) => void | Promise<void>;
	};

	let { errorMessage, isLoading, items, onReorderItems }: Props = $props();
	let searchQuery = $state('');
	let viewMode = $state<IssueListViewMode>('gallery');
	const filteredItems = $derived(
		searchQuery.trim()
			? items.filter((item) => itemSearchText(item).includes(searchQuery.trim().toLowerCase()))
			: items
	);

	function itemSearchText(item: CollectionItem) {
		const issue = item.userIssue?.issue;
		return [
			issue?.volume?.name,
			issue?.issueNumber,
			issue?.name,
			issue?.volume?.publisher?.name,
			issue?.summary
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
	}

	function closeSearch() {
		searchQuery = '';
	}

	async function reorderItems(orderedItems: CollectionItem[]) {
		if (searchQuery.trim() || !onReorderItems) return;

		await onReorderItems(orderedItems);
	}
</script>

<IssueListPanel
	{errorMessage}
	{isLoading}
	items={filteredItems}
	onReorderItems={onReorderItems ? reorderItems : undefined}
	{viewMode}
	onViewModeChange={(nextViewMode) => {
		viewMode = nextViewMode;
	}}
>
	{#snippet controls()}
		<div class="relative size-9">
			<div
				class={`group absolute -right-1 -top-1 z-10 flex h-11 items-center p-1 transition-[width] duration-200 ease-out hover:w-[16.5rem] focus-within:w-[16.5rem] ${
					searchQuery.trim() ? 'w-[16.5rem]' : 'w-11'
				}`}
			>
				<div class="relative flex h-9 w-full items-center overflow-hidden rounded-md">
					<div
						class={`pointer-events-none absolute inset-0 rounded-md bg-muted transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100 ${
							searchQuery.trim() ? 'opacity-100' : 'opacity-0'
						}`}
					></div>
					<div class="pointer-events-none relative inline-flex size-9 shrink-0 items-center justify-center text-muted-foreground">
						<Search class="size-4" />
					</div>
					<input
						class={`relative h-9 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none transition-opacity duration-150 placeholder:text-muted-foreground focus:border-transparent focus:ring-0 group-hover:opacity-100 group-focus-within:opacity-100 ${
							searchQuery.trim() ? 'opacity-100' : 'opacity-0'
						}`}
						aria-label="Search collection"
						placeholder="Search collection"
						bind:value={searchQuery}
						onkeydown={(event) => {
							if (event.key === 'Escape') {
								closeSearch();
							}
						}}
					/>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet empty()}
		<p class="px-4 py-12 text-center text-sm text-muted-foreground">
			Added ComicVine issues will appear here with publisher, volume, characters, and credits.
		</p>
	{/snippet}
</IssueListPanel>
