<script lang="ts">
	import { Plus, Search } from '@lucide/svelte';
	import IssueListPanel, { type IssueListViewMode } from './IssueListPanel.svelte';
	import type { CollectionItem } from '$lib/comics/types';

	type Props = {
		errorMessage: string | null;
		isLoading: boolean;
		items: CollectionItem[];
		onAddIssue: () => void;
		onRemoveIssue?: (itemId: string) => void | Promise<void>;
		onReorderItems?: (items: CollectionItem[]) => void | Promise<void>;
		removingItemIds?: string[];
	};

	let {
		errorMessage,
		isLoading,
		items,
		onAddIssue,
		onRemoveIssue,
		onReorderItems,
		removingItemIds = []
	}: Props = $props();
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
	onRemoveListItem={onRemoveIssue}
	onReorderItems={onReorderItems ? reorderItems : undefined}
	{removingItemIds}
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
		<div class="grid gap-3 px-4 py-12 text-center">
			<div class="grid gap-1">
				<h2 class="text-base font-semibold">Your collection is empty</h2>
				<p class="text-sm text-muted-foreground">
					Add your first issue to start building your collection.
				</p>
			</div>
			<button
				type="button"
				class="mx-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
				onclick={onAddIssue}
			>
				<Plus class="size-4" />
				Add first issue
			</button>
		</div>
	{/snippet}
</IssueListPanel>
