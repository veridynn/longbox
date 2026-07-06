<script lang="ts">
	import { onMount } from 'svelte';
	import { ListPlus, LoaderCircle } from '@lucide/svelte';
	import InlineListTitle from '$lib/features/lists/InlineListTitle.svelte';
	import type { CustomListSummary } from '$lib/features/lists/lists';
	import Section from './Section.svelte';

	type Props = {
		customLists: CustomListSummary[];
		errorMessage?: string | null;
		isLoading?: boolean;
		onCreateList: () => void;
		onRenameList: (listId: string, name: string) => void | Promise<void>;
	};

	let {
		customLists,
		errorMessage = null,
		isLoading = false,
		onCreateList,
		onRenameList
	}: Props = $props();
	let shortcutModifier = $state('⌘');
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

	<div class="pb-1">
		{#if isLoading}
			<div class="flex items-center text-sm text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading lists
			</div>
		{:else if errorMessage}
			<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{errorMessage}
			</p>
		{:else}
			<div class="flex flex-wrap gap-3">
				{#each customLists as list (list.id)}
					<div class="rounded-md border border-border bg-background px-3 py-2">
						<InlineListTitle
							class="font-medium"
							existingNames={existingListNames}
							isSubmitting={false}
							name={list.name}
							onRename={(name) => onRenameList(list.id, name)}
						/>
						<a
							class="mt-1 block text-sm text-muted-foreground underline-offset-4 hover:underline"
							href={`/list/${list.id}`}
						>
							{issueLabel(list.issueCount)}
						</a>
						<a
							class="mt-3 block underline-offset-4 hover:underline"
							href={`/list/${list.id}`}
							aria-label={`Open ${list.name}`}
						>
							<div class="relative h-52 w-56">
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
