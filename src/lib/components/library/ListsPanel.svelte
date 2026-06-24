<script lang="ts">
	import { onMount } from 'svelte';
	import { List, Plus } from '@lucide/svelte';
	import type { CustomListSummary } from './lists';

	type Props = {
		customLists: CustomListSummary[];
		onCreateList: () => void;
	};

	let { customLists, onCreateList }: Props = $props();
	let shortcutModifier = $state('⌘');

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

<section aria-labelledby="lists-heading" class="grid gap-3">
	<div class="flex items-center justify-between">
		<h2 id="lists-heading" class="font-semibold">Lists</h2>
	</div>

	<div class="-mx-5 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
		<div class="flex w-max min-w-full gap-3">
			{#each customLists as list (list.id)}
				<a
					class="w-56 shrink-0 p-1 underline-offset-4 hover:underline"
					href={`/list/${list.id}`}
				>
					<div class="mb-3">
						<h3 class="truncate font-medium" title={list.name}>{list.name}</h3>
						<p class="mt-1 text-sm text-muted-foreground">{issueLabel(list.issueCount)}</p>
					</div>
					{#if list.coverImageUrls.length}
						<div class="relative h-52">
							{#each list.coverImageUrls as coverImageUrl, index (coverImageUrl)}
								<img
									class="absolute h-36 w-24 border border-background object-cover shadow-md"
									src={coverImageUrl}
									alt=""
									style:left={`${index * 8}px`}
									style:bottom={`${index * 16}px`}
									style:z-index={list.coverImageUrls.length - index}
									style:opacity={coverOpacity(index)}
								/>
							{/each}
						</div>
					{:else}
						<div class="flex h-36 w-24 items-center justify-center border border-border bg-muted text-muted-foreground">
							<List class="size-4" />
						</div>
					{/if}
				</a>
			{/each}

			<button
				type="button"
				class="flex h-72 w-56 shrink-0 flex-col justify-between border border-dashed border-border bg-background p-4 text-left hover:border-foreground/30 hover:bg-muted/50"
				onclick={onCreateList}
			>
				<div class="flex size-9 items-center justify-center border border-border bg-card text-muted-foreground">
					<Plus class="size-4" />
				</div>
				<div>
					<h3 class="font-medium">Create new list</h3>
					<span class="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
						<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">{shortcutModifier}</kbd>
						<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">L</kbd>
					</span>
				</div>
			</button>
		</div>
	</div>
</section>
