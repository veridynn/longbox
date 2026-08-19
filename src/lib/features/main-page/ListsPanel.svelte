<script lang="ts">
	import { onMount } from 'svelte';
	import { CircleAlert, ListPlus, LoaderCircle } from '@lucide/svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import * as Rename from '$lib/components/ui/rename';
	import { validateListName, type CustomListSummary } from '$lib/features/lists/lists';
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

	<div class="min-w-0 pb-1">
		{#if isLoading}
			<div class="flex items-center text-sm text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading lists
			</div>
		{:else if errorMessage}
			<Alert.Root variant="destructive">
				<CircleAlert aria-hidden="true" />
				<Alert.Title>Couldn’t load lists</Alert.Title>
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{:else if !customLists.length}
			<Empty.Root class="py-8">
				<Empty.Header>
					<Empty.Media variant="icon">
						<ListPlus aria-hidden="true" />
					</Empty.Media>
					<Empty.Title>
						<h3>Create your first list</h3>
					</Empty.Title>
					<Empty.Description>Group issues into reading queues, favorites, or any collection you want.</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button onclick={onCreateList}>
						<ListPlus data-icon="inline-start" />
						Create list
					</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<div
				class="flex min-w-0 w-full flex-nowrap gap-3 overflow-x-auto overscroll-x-contain pb-2"
				data-list-carousel
			>
				{#each customLists as list (list.id)}
					<div
						class="w-40 shrink-0 rounded-md border border-border bg-background px-2.5 py-2"
						data-list-card
					>
						<Rename.Root
							this="span"
							value={list.name}
							class="block w-full truncate font-medium"
							inputClass="h-8 px-2"
							validate={(name) => !validateListName(name.trim(), existingListNames, list.name)}
							onSave={(name) => onRenameList(list.id, name.trim())}
						/>
						<a
							class="mt-2 block underline-offset-4 hover:underline"
							href={`/list/${list.id}`}
							aria-label={`Open ${list.name}`}
						>
							<div class="relative h-32 w-full">
								{#each coverSlots(list.coverImageUrls) as coverImageUrl, index (index)}
									{#if coverImageUrl}
										<img
											class="absolute h-24 w-16 border border-background object-cover shadow-md"
											src={coverImageUrl}
											alt=""
											style:left={`${26 + index * 6}px`}
											style:bottom={`${index * 8}px`}
											style:z-index={5 - index}
											style:opacity={coverOpacity(index)}
										/>
									{:else}
										<div
											aria-hidden="true"
											class="absolute h-24 w-16 border border-background bg-muted shadow-md"
											style:left={`${26 + index * 6}px`}
											style:bottom={`${index * 8}px`}
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
