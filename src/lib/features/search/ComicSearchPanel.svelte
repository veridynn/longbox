<script lang="ts">
	import { tick } from 'svelte';
	import {
		Check,
		ChevronDown,
		CircleAlert,
		LoaderCircle,
		Plus,
		RotateCcw,
		Search,
		SearchX,
		X
	} from '@lucide/svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Empty from '$lib/components/ui/empty';
	import { formatDate } from '$lib/comics/format';
	import type {
		CollectionItem,
		SearchIssue,
		SearchSuggestion,
		SearchVolume
	} from '$lib/comics/types';
	import {
		SEARCH_COMMANDS,
		type ComicSearchState,
		type SearchTag,
		type SearchTagType
	} from './comic-search-state.svelte';

	type Props = {
		addError: string | null;
		addingIssueIds: number[];
		addingUserIssueIds?: string[];
		addedLabel?: string;
		isInCollection: (issue: SearchIssue) => boolean;
		isCollectionItemAdded?: (item: CollectionItem) => boolean;
		collectionItems?: CollectionItem[];
		onAddIssue: (issue: SearchIssue) => boolean | void | Promise<boolean | void>;
		onAddCollectionItem?: (item: CollectionItem) => void;
		open: boolean;
		search: ComicSearchState;
		targetName?: string;
	};

	let {
		addError,
		addingIssueIds,
		addingUserIssueIds = [],
		addedLabel = 'Owned',
		isInCollection,
		isCollectionItemAdded = () => false,
		collectionItems = [],
		onAddIssue,
		onAddCollectionItem,
		open = $bindable(),
		search,
		targetName = 'Collection'
	}: Props = $props();

	type MenuItem = (typeof SEARCH_COMMANDS)[number] | SearchSuggestion;
	let composerInput = $state<HTMLInputElement | null>(null);
	let activeMenuIndex = $state(0);
	let addingVolumeId = $state<number | null>(null);
	let volumeAddProgress = $state({ completed: 0, total: 0 });
	let volumeAddErrors = $state<Record<number, string>>({});
	const commandItems = $derived.by(() => {
		if (!search.draft.startsWith('/')) return [];
		const query = search.draft.toLocaleLowerCase();
		return SEARCH_COMMANDS.filter((command) => command.command.startsWith(query));
	});
	const menuItems = $derived<MenuItem[]>(commandItems.length ? commandItems : search.suggestions);
	const showMenu = $derived(
		menuItems.length > 0 || search.isSuggesting || Boolean(search.suggestionError)
	);
	const matchingCollectionItems = $derived.by(() => {
		if (!search.tags.length) return [];
		const volume = search.volumeTag?.value.toLocaleLowerCase();
		const issueNumber = search.issueTag?.value.toLocaleLowerCase();
		const publisher = search.publisherTag?.label.toLocaleLowerCase();
		const characters = search.characterTags.map((tag) => tag.label.toLocaleLowerCase());

		return collectionItems.filter((item) => {
			const issue = item.userIssue?.issue;
			if (!issue) return false;
			const issueCharacters = (issue.issueCharacters ?? []).flatMap((credit) => {
				const character = credit.character;
				if (Array.isArray(character)) return character.map((value) => value.name.toLocaleLowerCase());
				return character?.name ? [character.name.toLocaleLowerCase()] : [];
			});
			return (
				(!volume || issue.volume?.name.toLocaleLowerCase().includes(volume)) &&
				(!issueNumber || issue.issueNumber.toLocaleLowerCase() === issueNumber) &&
				(!publisher || issue.volume?.publisher?.name.toLocaleLowerCase() === publisher) &&
				characters.every((character) => issueCharacters.includes(character))
			);
		});
	});

	$effect(() => {
		if (open) tick().then(() => requestAnimationFrame(() => composerInput?.focus()));
	});

	function updateDraft(value: string) {
		activeMenuIndex = 0;
		search.setDraft(value);
	}

	function isCommand(item: MenuItem): item is (typeof SEARCH_COMMANDS)[number] {
		return 'command' in item;
	}

	function chooseMenuItem(item: MenuItem) {
		if (isCommand(item)) search.selectCommand(item.type);
		else void search.addSuggestion(item);
	}

	function handleComposerKeydown(event: KeyboardEvent) {
		if (!menuItems.length) {
			if (event.key === 'Enter') {
				event.preventDefault();
				void search.commitDraft();
			}
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			activeMenuIndex = (activeMenuIndex + 1) % menuItems.length;
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			activeMenuIndex = (activeMenuIndex - 1 + menuItems.length) % menuItems.length;
		} else if (event.key === 'Enter') {
			event.preventDefault();
			chooseMenuItem(menuItems[activeMenuIndex] ?? menuItems[0]);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			search.setDraft('');
		}
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		void search.commitDraft();
	}

	function tagLabel(tag: SearchTag) {
		return `${tag.type[0].toLocaleUpperCase()}${tag.type.slice(1)}: ${tag.label}`;
	}

	function volumeTitle(volume: SearchVolume) {
		return `${volume.name}${volume.startYear ? ` (${volume.startYear})` : ''}`;
	}

	function searchIssueTitle(issue: SearchIssue) {
		return `${volumeTitle(issue.volume)} #${issue.issueNumber}${issue.name ? `: ${issue.name}` : ''}`;
	}

	function collectionItemTitle(item: CollectionItem) {
		const issue = item.userIssue?.issue;
		if (!issue) return 'Unknown issue';
		return `${issue.volume?.name ?? 'Unknown series'} #${issue.issueNumber}${issue.name ? `: ${issue.name}` : ''}`;
	}

	function placeholder(type: SearchTagType) {
		return `Search by ${type}`;
	}

	async function addVolume(volume: SearchVolume) {
		if (addingVolumeId !== null) return;
		addingVolumeId = volume.id;
		volumeAddProgress = { completed: 0, total: 0 };
		volumeAddErrors = { ...volumeAddErrors, [volume.id]: '' };

		try {
			const issues = await search.allIssuesForVolume(volume);
			volumeAddProgress = { completed: 0, total: issues.length };
			// ponytail: sequential imports favor ComicVine's rate limit; add a bulk endpoint if large runs are too slow.
			for (const [index, issue] of issues.entries()) {
				if (!isInCollection(issue) && (await onAddIssue(issue)) === false) {
					throw new Error('Stopped before the whole volume was added. Retry to continue.');
				}
				volumeAddProgress = { completed: index + 1, total: issues.length };
			}
		} catch (error) {
			volumeAddErrors = {
				...volumeAddErrors,
				[volume.id]: error instanceof Error ? error.message : 'Unable to add this volume.'
			};
		} finally {
			addingVolumeId = null;
		}
	}
</script>

<Command.Dialog
	bind:open
	class="top-8 max-h-[calc(100dvh-4rem)] w-[calc(100vw-2rem)] max-w-2xl translate-y-0 sm:max-w-2xl"
	description="Find DC Comics volumes and issues by volume, character, publisher, or issue number."
	title="Add comics"
>
	<form class="grid gap-3 border-b border-border p-4" onsubmit={submit}>
		<label class="grid gap-1 text-xs font-medium" for="comic-filter-input">Find comics</label>
		<div class="relative">
			<div class="flex rounded-md border border-input bg-input/30 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
				<select
					class="h-11 rounded-l-md border-r border-input bg-transparent px-3 text-sm font-medium outline-none"
					aria-label="Search type"
					value={search.filterType}
					onchange={(event) => search.setFilterType(event.currentTarget.value as SearchTagType)}
				>
					{#each SEARCH_COMMANDS as command}
						<option value={command.type}>{command.label}</option>
					{/each}
				</select>
				<div class="relative min-w-0 flex-1">
					<Search class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<input
						bind:this={composerInput}
						id="comic-filter-input"
						class="h-11 w-full bg-transparent pr-3 pl-9 text-sm outline-none"
						autocomplete="off"
						aria-autocomplete="list"
						aria-controls={showMenu ? 'comic-filter-options' : undefined}
						aria-expanded={showMenu}
						oninput={(event) => updateDraft(event.currentTarget.value)}
						onkeydown={handleComposerKeydown}
						placeholder={placeholder(search.filterType)}
						value={search.draft}
					/>
				</div>
				<button type="submit" class="h-11 border-l border-input px-4 text-sm font-medium hover:bg-muted">Search</button>
			</div>

			{#if showMenu}
				<div id="comic-filter-options" class="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md" role="listbox">
					{#each menuItems as item, index (isCommand(item) ? item.command : `${item.type}:${item.id}`)}
						<button
							type="button"
							class={`flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm ${index === activeMenuIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
							role="option"
							aria-selected={index === activeMenuIndex}
							onclick={() => chooseMenuItem(item)}
						>
							<span>{isCommand(item) ? item.command : item.label}</span>
							<span class="text-xs text-muted-foreground">{isCommand(item) ? item.label : item.subtitle}</span>
						</button>
					{/each}
					{#if search.isSuggesting}<p class="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><LoaderCircle class="size-4 animate-spin" /> Loading suggestions…</p>{/if}
					{#if search.suggestionError}<p class="px-3 py-2 text-sm text-destructive">{search.suggestionError}</p>{/if}
				</div>
			{/if}
		</div>

		<div class="relative h-8" aria-label="Active comic searches">
			{#if search.inputError}
				<p class="flex h-8 items-center text-xs text-destructive" role="alert">{search.inputError}</p>
			{:else if search.tags.length}
				<div class="flex h-8 gap-2 overflow-x-auto pr-24 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
					{#each search.tags as tag (`${tag.type}:${tag.type === 'character' || tag.type === 'publisher' ? tag.id : tag.value}`)}
						<span class="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2.5 text-xs font-medium">
							{tagLabel(tag)}
							<button type="button" class="rounded-full p-0.5 hover:bg-background" aria-label={`Remove ${tagLabel(tag)}`} onclick={() => search.removeTag(tag)}><X class="size-3.5" /></button>
						</span>
					{/each}
				</div>
				<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center bg-gradient-to-r from-transparent via-popover to-popover pl-8">
					<button type="button" class="pointer-events-auto inline-flex h-8 items-center gap-1 bg-popover pl-2 text-xs font-medium text-muted-foreground hover:text-foreground" onclick={() => search.reset()}><RotateCcw class="size-3.5" /> Clear</button>
				</div>
			{:else}
				<p class="flex h-8 items-center gap-1 text-xs text-muted-foreground">Type <kbd class="rounded border border-border px-1">/</kbd> for search commands</p>
			{/if}
		</div>
	</form>

	{#if search.error || addError}
		<div class="mx-4 mt-3 grid gap-2">
			{#if search.error}
				<Alert.Root variant="destructive">
					<CircleAlert aria-hidden="true" />
					<Alert.Title>Search failed</Alert.Title>
					<Alert.Description>
						<div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p>{search.error}</p>
							<Button size="sm" variant="outline" onclick={() => search.search()}>
								<RotateCcw data-icon="inline-start" />
								Retry
							</Button>
						</div>
					</Alert.Description>
				</Alert.Root>
			{/if}
			{#if addError}
				<Alert.Root variant="destructive">
					<CircleAlert aria-hidden="true" />
					<Alert.Title>Couldn’t add this issue</Alert.Title>
					<Alert.Description>{addError}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>
	{/if}

	<h2 class="px-4 pt-3 text-sm font-semibold">{search.volumes.length ? `${search.volumes.length} matching runs` : 'Matching runs'}</h2>

	<Command.List class="max-h-[min(38rem,calc(100dvh-17rem))]">
		{#if matchingCollectionItems.length}
			<div class="px-4 pt-3 pb-2"><h3 class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your collection</h3></div>
			<ul class="divide-y divide-border border-b border-border">
				{#each matchingCollectionItems as item (item.id)}
					{@const issue = item.userIssue?.issue}
					{@const userIssueId = item.userIssue?.id}
					{#if issue && userIssueId}
						<li class="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 px-3 py-3 sm:flex sm:px-4">
							<img class="h-24 w-16 shrink-0 border border-border object-cover" src={issue.coverImageUrl ?? '/robots.txt'} alt="" />
							<div class="min-w-0 flex-1"><h4 class="line-clamp-2 text-sm font-semibold">{collectionItemTitle(item)}</h4><p class="mt-1 text-xs text-muted-foreground">{formatDate(issue.coverDate)}</p></div>
							<button type="button" class="col-start-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-70 sm:col-auto sm:shrink-0" disabled={addingUserIssueIds.includes(userIssueId) || isCollectionItemAdded(item)} onclick={() => onAddCollectionItem?.(item)}>
								{#if addingUserIssueIds.includes(userIssueId)}<LoaderCircle class="size-4 animate-spin" />{:else if isCollectionItemAdded(item)}<Check class="size-4" /> {addedLabel}{:else}<Plus class="size-4" /> Add{/if}
							</button>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}

		{#if search.volumes.length}
			<div class="grid gap-2 p-3">
				{#each search.volumes as volume (volume.id)}
					{@const volumeState = search.volumeIssues[volume.id]}
					<details class="group rounded-md border border-border bg-card" open={search.openVolumeIds.includes(volume.id)} ontoggle={(event) => search.toggleVolume(volume, event.currentTarget.open)}>
						<summary class="flex cursor-pointer list-none items-center gap-3 p-3 marker:content-none hover:bg-muted/40">
							<img class="h-20 w-14 shrink-0 border border-border object-cover" src={volume.coverImageUrl ?? '/robots.txt'} alt="" />
							<div class="min-w-0 flex-1">
								<h3 class="truncate text-sm font-semibold">{volumeTitle(volume)}</h3>
								<p class="mt-1 text-xs text-muted-foreground">{volume.publisher?.name ?? 'Unknown publisher'}{volume.issueCount !== null ? ` · ${volume.issueCount} issues` : ''}</p>
								{#if volumeState?.loaded && !volumeState.hasMore}<p class="mt-1 text-xs text-muted-foreground">{volumeState.issues.length} matching {volumeState.issues.length === 1 ? 'issue' : 'issues'}</p>{/if}
							</div>
							{#if volumeState?.isLoading}<LoaderCircle class="size-4 animate-spin text-muted-foreground" />{/if}
							<ChevronDown class="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
						</summary>

						<div class="border-t border-border">
							<div class="flex flex-col items-stretch gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
								<p class="text-xs text-muted-foreground">Add every issue in this run.</p>
								<button type="button" class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-70" disabled={addingVolumeId !== null} onclick={() => addVolume(volume)}>
									{#if addingVolumeId === volume.id}<LoaderCircle class="size-4 animate-spin" /> Adding {volumeAddProgress.completed}/{volumeAddProgress.total || volume.issueCount || '…'}{:else}<Plus class="size-4" /> Add whole volume{/if}
								</button>
							</div>
							{#if volumeAddErrors[volume.id]}
								<Alert.Root class="m-3 w-auto" variant="destructive">
									<CircleAlert aria-hidden="true" />
									<Alert.Title>Couldn’t add this volume</Alert.Title>
									<Alert.Description>{volumeAddErrors[volume.id]}</Alert.Description>
								</Alert.Root>
							{/if}
							{#if volumeState?.error}
								<Alert.Root class="m-3 w-auto" variant="destructive">
									<CircleAlert aria-hidden="true" />
									<Alert.Title>Couldn’t load issues</Alert.Title>
									<Alert.Description>
										<div class="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
											<p>{volumeState.error}</p>
											<Button size="sm" variant="outline" onclick={() => search.loadVolume(volume)}>
												<RotateCcw data-icon="inline-start" />
												Retry
											</Button>
										</div>
									</Alert.Description>
								</Alert.Root>
							{:else if volumeState?.loaded && !volumeState.issues.length}
								<Empty.Root class="py-8" role="status">
									<Empty.Header>
										<Empty.Title>
											<h4>No matching issues</h4>
										</Empty.Title>
										<Empty.Description>
											No issues in this run match every search tag.
										</Empty.Description>
									</Empty.Header>
								</Empty.Root>
							{:else if volumeState?.issues.length}
								<ul class="divide-y divide-border">
									{#each volumeState.issues as issue (issue.id)}
										<li class="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 px-3 py-3 sm:flex sm:px-4">
											<img class="h-24 w-16 shrink-0 border border-border object-cover" src={issue.coverImageUrl ?? '/robots.txt'} alt="" />
											<div class="min-w-0 flex-1">
												<h4 class="line-clamp-2 text-sm font-semibold">{searchIssueTitle(issue)}</h4>
												<p class="mt-1 text-xs text-muted-foreground">{issue.volume.publisher?.name ?? 'Unknown publisher'} · {formatDate(issue.coverDate)}</p>
												{#if issue.siteDetailUrl}<a class="mt-2 inline-block text-xs font-medium underline-offset-4 hover:underline" href={issue.siteDetailUrl} target="_blank" rel="noreferrer">View source</a>{/if}
											</div>
											<button type="button" class="col-start-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-70 sm:col-auto sm:shrink-0" aria-label={isInCollection(issue) ? `${searchIssueTitle(issue)} is already in ${targetName}` : `Add ${searchIssueTitle(issue)} to ${targetName}`} disabled={addingIssueIds.includes(issue.id) || isInCollection(issue)} onclick={() => onAddIssue(issue)}>
												{#if addingIssueIds.includes(issue.id)}<LoaderCircle class="size-4 animate-spin" />{:else if isInCollection(issue)}<Check class="size-4" /> {addedLabel}{:else}<Plus class="size-4" /> Add{/if}
											</button>
										</li>
									{/each}
								</ul>
							{/if}
							{#if volumeState?.hasMore && !volumeState.isLoading}<div class="border-t border-border p-3 text-center"><button type="button" class="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted" onclick={() => search.loadVolume(volume, { append: true })}>Load more issues</button></div>{/if}
						</div>
					</details>
				{/each}
			</div>
		{:else if search.isSearching}
			<p class="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground" role="status"><LoaderCircle class="size-4 animate-spin" /> Searching comics…</p>
		{:else if search.hasSearched && !search.hasAnchor}
			<Empty.Root class="py-12" role="status">
				<Empty.Header>
					<Empty.Media variant="icon">
						<Search aria-hidden="true" />
					</Empty.Media>
					<Empty.Title>
						<h3>Add a volume or character</h3>
					</Empty.Title>
					<Empty.Description>
						Add a Volume or Character search before looking for matching runs.
					</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{:else if search.hasSearched && !search.error}
			<Empty.Root class="py-12" role="status">
				<Empty.Header>
					<Empty.Media variant="icon">
						<SearchX aria-hidden="true" />
					</Empty.Media>
					<Empty.Title>
						<h3>No matching runs found</h3>
					</Empty.Title>
					<Empty.Description>
						Remove a search tag or try a broader volume title.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button variant="outline" onclick={() => search.reset()}>
						<RotateCcw data-icon="inline-start" />
						Clear search
					</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<Empty.Root class="py-12">
				<Empty.Header>
					<Empty.Media variant="icon">
						<Search aria-hidden="true" />
					</Empty.Media>
					<Empty.Title>
						<h3>Search comics</h3>
					</Empty.Title>
					<Empty.Description>
						Add a volume or character search to find comics.
					</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{/if}

		{#if search.hasMore && !search.isSearching}
			<div class="border-t border-border p-3 text-center"><button type="button" class="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted" onclick={() => search.search({ append: true })}>Load more runs</button></div>
		{/if}
	</Command.List>
</Command.Dialog>
