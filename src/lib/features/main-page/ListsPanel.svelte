<script lang="ts">
	import { onMount } from 'svelte';
	import { ListPlus, LoaderCircle, Trash2 } from '@lucide/svelte';
	import DeleteListDialog from '$lib/features/lists/DeleteListDialog.svelte';
	import InlineListTitle from '$lib/features/lists/InlineListTitle.svelte';
	import type { CustomListSummary } from '$lib/features/lists/lists';
	import Section from './Section.svelte';

	type Props = {
		customLists: CustomListSummary[];
		errorMessage?: string | null;
		isLoading?: boolean;
		onDeleteList: (list: CustomListSummary) => void | Promise<void>;
		onCreateList: () => void;
		onRenameList: (listId: string, name: string) => void | Promise<void>;
	};

	let {
		customLists,
		errorMessage = null,
		isLoading = false,
		onCreateList,
		onDeleteList,
		onRenameList
	}: Props = $props();
	let shortcutModifier = $state('⌘');
	let deleteErrorMessage = $state<string | null>(null);
	let deleteListOpen = $state(false);
	let deletingListId = $state<string | null>(null);
	let selectedDeleteList = $state<CustomListSummary | null>(null);
	const existingListNames = $derived(customLists.map((list) => list.name));

	onMount(() => {
		if (!/(Mac|iPhone|iPad|iPod)/.test(navigator.platform)) {
			shortcutModifier = 'Ctrl';
		}
	});

	function issueLabel(count: number) {
		return `${count} ${count === 1 ? 'issue' : 'issues'}`;
	}

	function coverOpacity(index: number) {
		return String(Math.max(0.28, 1 - index * 0.17));
	}

	function coverSlots(coverImageUrls: string[]) {
		return Array.from({ length: 5 }, (_, index) => coverImageUrls[index] ?? null);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (
			event.defaultPrevented ||
			event.key.toLowerCase() !== 'l' ||
			event.shiftKey ||
			(!event.metaKey && !event.ctrlKey)
		) {
			return;
		}

		event.preventDefault();
		onCreateList();
	}

	function openDeleteList(list: CustomListSummary) {
		selectedDeleteList = list;
		deleteErrorMessage = null;
		deleteListOpen = true;
	}

	function closeDeleteList() {
		if (deletingListId) return;

		deleteListOpen = false;
		selectedDeleteList = null;
		deleteErrorMessage = null;
	}

	async function deleteSelectedList() {
		if (!selectedDeleteList || deletingListId) return;

		deletingListId = selectedDeleteList.id;
		deleteErrorMessage = null;

		try {
			await onDeleteList(selectedDeleteList);
			deleteListOpen = false;
			selectedDeleteList = null;
		} catch (error) {
			deleteErrorMessage = error instanceof Error ? error.message : 'Unable to delete this list.';
		} finally {
			deletingListId = null;
		}
	}
</script>

<svelte:document onkeydown={handleKeydown} />

<Section title="Lists">
	{#snippet actions()}
		<button
			type="button"
			class="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted/50"
			onclick={onCreateList}
		>
			<ListPlus class="size-4" />
			Create list
			<span class="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{shortcutModifier}</kbd>
				<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">L</kbd>
			</span>
		</button>
	{/snippet}

	<div class="-mx-5 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
		{#if isLoading}
			<div class="flex min-h-52 items-center text-sm text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading lists
			</div>
		{:else if errorMessage}
			<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{errorMessage}
			</p>
		{:else}
			<div class="flex w-max min-w-full gap-3">
				{#each customLists as list (list.id)}
					<div class="w-56 shrink-0 p-1">
						<div class="mb-3 flex items-start justify-between gap-2">
							<div class="min-w-0">
								<InlineListTitle
									class="font-medium"
									existingNames={existingListNames}
									isSubmitting={deletingListId === list.id}
									name={list.name}
									onRename={(name) => onRenameList(list.id, name)}
								/>
								<p class="mt-1 text-sm text-muted-foreground">{issueLabel(list.issueCount)}</p>
							</div>
							<button
								type="button"
								class="rounded-md p-1.5 text-destructive opacity-70 hover:bg-destructive/10 hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={deletingListId === list.id}
								aria-label={`Delete ${list.name}`}
								onclick={() => openDeleteList(list)}
							>
								<Trash2 class="size-4" />
							</button>
						</div>

						<a class="block underline-offset-4 hover:underline" href={`/list/${list.id}`}>
							<div class="relative h-52">
								{#each coverSlots(list.coverImageUrls) as coverImageUrl, index (index)}
									{#if coverImageUrl}
										<img
											class="absolute h-36 w-24 border border-background object-cover shadow-md"
											src={coverImageUrl}
											alt=""
											style:left={`${index * 8}px`}
											style:bottom={`${index * 16}px`}
											style:z-index={5 - index}
											style:opacity={coverOpacity(index)}
										/>
									{:else}
										<div
											aria-hidden="true"
											class="absolute h-36 w-24 border border-background bg-muted shadow-md"
											style:left={`${index * 8}px`}
											style:bottom={`${index * 16}px`}
											style:z-index={5 - index}
											style:opacity={coverOpacity(index)}
										></div>
									{/if}
								{/each}
							</div>
						</a>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Section>

{#if selectedDeleteList}
	<DeleteListDialog
		errorMessage={deleteErrorMessage}
		isSubmitting={deletingListId === selectedDeleteList.id}
		listName={selectedDeleteList.name}
		bind:open={deleteListOpen}
		onCancel={closeDeleteList}
		onConfirm={deleteSelectedList}
	/>
{/if}
