<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import IssueListPanel from '$lib/features/issues/IssueListPanel.svelte';
	import type { IssueListViewMode } from '$lib/features/issues/view-mode';
	import type { CollectionItem, UserIssuePatch } from '$lib/comics/types';
	import type { IssueSortKey } from '$lib/features/issues/sort';
	import Section from './Section.svelte';

	type Props = {
		errorMessage: string | null;
		isLoading: boolean;
		items: CollectionItem[];
		onAddIssue: () => void;
		onRemoveIssue?: (itemId: string) => void | Promise<void>;
		onSortKeyChange: (sortKey: IssueSortKey) => void | Promise<void>;
		onUpdateUserIssue?: (userIssueId: string, patch: UserIssuePatch) => void | Promise<void>;
		onViewModeChange: (viewMode: IssueListViewMode) => void;
		removingItemIds?: string[];
		sortKey: IssueSortKey;
		viewMode: IssueListViewMode;
	};

	let {
		errorMessage,
		isLoading,
		items,
		onAddIssue,
		onRemoveIssue,
		onSortKeyChange,
		onUpdateUserIssue,
		onViewModeChange,
		removingItemIds = [],
		sortKey,
		viewMode
	}: Props = $props();
</script>

<Section title="Collection">
	<IssueListPanel
		{errorMessage}
		{isLoading}
		{items}
		onRemoveListItem={onRemoveIssue}
		{sortKey}
		{onSortKeyChange}
		{onUpdateUserIssue}
		{removingItemIds}
		{viewMode}
		{onViewModeChange}
	>
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
</Section>
