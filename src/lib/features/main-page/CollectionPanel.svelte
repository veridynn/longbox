<script lang="ts">
	import { onMount } from 'svelte';
	import { LibraryBig, Plus, Search } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
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
	let shortcutModifier = $state('⌘');

	onMount(() => {
		if (!/(Mac|iPhone|iPad|iPod)/.test(navigator.platform)) {
			shortcutModifier = 'Ctrl';
		}
	});
</script>

<Section title="Collection">
	{#snippet actions()}
		<button
			type="button"
			class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
			aria-label="Open comic search"
			onclick={onAddIssue}
		>
			<Search class="size-4" />
			<span>Search</span>
			<span class="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
				<kbd
					class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium"
				>
					{shortcutModifier}
				</kbd>
				<kbd
					class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium"
				>
					K
				</kbd>
			</span>
		</button>
	{/snippet}

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
			<Empty.Root class="py-12">
				<Empty.Header>
					<Empty.Media variant="icon">
						<LibraryBig aria-hidden="true" />
					</Empty.Media>
					<Empty.Title>
						<h2>Your collection is empty</h2>
					</Empty.Title>
					<Empty.Description>
						Add your first issue to start building your collection.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button onclick={onAddIssue}>
						<Plus data-icon="inline-start" />
						Add first issue
					</Button>
				</Empty.Content>
			</Empty.Root>
		{/snippet}
	</IssueListPanel>
</Section>
