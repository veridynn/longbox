<script lang="ts">
	import { id } from '@instantdb/svelte';
	import { ArrowLeft, LoaderCircle, Plus } from '@lucide/svelte';
	import type { PageProps } from './$types';
	import ComicSearchPanel from '$lib/components/library/ComicSearchPanel.svelte';
	import { customListItemKey } from '$lib/components/library/lists';
	import { formatDate } from '$lib/comics/format';
	import type { LibraryItem, SearchIssue } from '$lib/comics/types';
	import { issueViewTransitionName } from '$lib/comics/view-transitions.svelte';
	import { db } from '$lib/db';

	type UserList = {
		id: string;
		listKey: string;
		name: string;
		items: LibraryItem[];
	};

	let { params }: PageProps = $props();

	const auth = db.useAuth();
	const listQuery = db.useQuery(() =>
		auth.user
			? {
					userLists: {
						$: {
							where: {
								id: params.listId,
								'owner.id': auth.user.id
							}
						},
						items: {
							$: {
								order: {
									position: 'asc'
								}
							},
							userIssue: {
								issue: {
									volume: {
										publisher: {}
									},
									issueCharacters: {
										character: {}
									},
									credits: {
										person: {}
									}
								}
							}
						}
					}
				}
			: null
	);
	const libraryQuery = db.useQuery(() =>
		auth.user
			? {
					userLists: {
						$: {
							where: {
								'owner.id': auth.user.id,
								name: 'Library'
							}
						},
						items: {
							$: {
								order: {
									position: 'asc'
								}
							},
							userIssue: {
								issue: {
									volume: {
										publisher: {}
									}
								}
							}
						}
					}
				}
			: null
	);

	let query = $state('');
	let results = $state<SearchIssue[]>([]);
	let searchError = $state<string | null>(null);
	let addError = $state<string | null>(null);
	let isSearching = $state(false);
	let searchOpen = $state(false);
	let addingIssueIds = $state<number[]>([]);
	let addingUserIssueIds = $state<string[]>([]);

	const currentList = $derived((listQuery.data?.userLists?.[0] as UserList | undefined) ?? null);
	const listItems = $derived(
		((currentList?.items ?? []) as LibraryItem[]).filter((item) => item.userIssue?.issue)
	);
	const libraryItems = $derived(
		((libraryQuery.data?.userLists?.[0]?.items ?? []) as LibraryItem[]).filter(
			(item) => item.userIssue?.issue
		)
	);
	const listComicVineIds = $derived(
		new Set(
			listItems
				.map((item) => item.userIssue?.issue?.comicVineId)
				.filter((issueId): issueId is number => typeof issueId === 'number')
		)
	);
	const libraryItemByComicVineId = $derived(
		new Map(
			libraryItems
				.map((item) => [item.userIssue?.issue?.comicVineId, item] as const)
				.filter((entry): entry is readonly [number, LibraryItem] => typeof entry[0] === 'number')
		)
	);

	function issueTitle(item: LibraryItem) {
		const issue = item.userIssue?.issue;
		if (!issue) return 'Unknown issue';

		const issueName = issue.name ? `: ${issue.name}` : '';
		return `${issue.volume?.name ?? 'Unknown volume'} #${issue.issueNumber}${issueName}`;
	}

	function openSearch() {
		searchOpen = true;
	}

	function isSearchIssueInList(issue: SearchIssue) {
		return listComicVineIds.has(issue.id);
	}

	function isLibraryItemInList(item: LibraryItem) {
		const comicVineId = item.userIssue?.issue?.comicVineId;
		return typeof comicVineId === 'number' && listComicVineIds.has(comicVineId);
	}

	async function readJsonResponse(response: Response) {
		try {
			return (await response.json()) as { results?: SearchIssue[]; error?: string };
		} catch {
			return {};
		}
	}

	async function searchIssues() {
		const trimmed = query.trim();
		searchError = null;
		addError = null;

		if (!trimmed) {
			results = [];
			searchError = 'Enter a comic title, issue, or volume.';
			return;
		}

		isSearching = true;

		try {
			const response = await fetch(`/api/comicvine/search?q=${encodeURIComponent(trimmed)}`);
			const body = await readJsonResponse(response);

			if (!response.ok) {
				throw new Error(body.error ?? 'Search failed.');
			}

			results = body.results ?? [];
		} catch (error) {
			searchError = error instanceof Error ? error.message : 'Search failed.';
			results = [];
		} finally {
			isSearching = false;
		}
	}

	async function addLibraryItem(item: LibraryItem) {
		const list = currentList;
		const userIssueId = item.userIssue?.id;

		if (!list || !userIssueId || isLibraryItemInList(item)) {
			return;
		}

		addError = null;
		addingUserIssueIds = [...addingUserIssueIds, userIssueId];

		try {
			await db.transact(
				db.tx.userListItems[id()]
					.update({
						addedAt: new Date(),
						listItemKey: customListItemKey(list.listKey, userIssueId),
						position: listItems.length
					})
					.link({
						list: list.id,
						userIssue: userIssueId
					})
			);
		} catch (error) {
			addError = error instanceof Error ? error.message : 'Unable to add issue to this list.';
		} finally {
			addingUserIssueIds = addingUserIssueIds.filter((idValue) => idValue !== userIssueId);
		}
	}

	async function addIssue(issue: SearchIssue) {
		const libraryItem = libraryItemByComicVineId.get(issue.id);

		if (libraryItem) {
			await addLibraryItem(libraryItem);
			return;
		}

		if (isSearchIssueInList(issue)) {
			return;
		}

		if (!auth.user?.refresh_token || !currentList) {
			addError = 'Sign in before adding issues.';
			return;
		}

		addError = null;
		addingIssueIds = [...addingIssueIds, issue.id];

		try {
			const response = await fetch('/api/library/add', {
				method: 'POST',
				headers: {
					authorization: `Bearer ${auth.user.refresh_token}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify({ issueId: issue.id, listId: currentList.id })
			});
			const body = await readJsonResponse(response);

			if (!response.ok) {
				throw new Error(body.error ?? 'Unable to add issue.');
			}
		} catch (error) {
			addError = error instanceof Error ? error.message : 'Unable to add issue.';
		} finally {
			addingIssueIds = addingIssueIds.filter((idValue) => idValue !== issue.id);
		}
	}
</script>

<svelte:head>
	<title>{currentList?.name ?? 'List'} · Longbox</title>
</svelte:head>

<main class="min-h-screen bg-background text-foreground">
	<section class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
		<header class="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<a
					class="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
					href="/"
				>
					<ArrowLeft class="size-4" />
					Library
				</a>
				<h1 class="mt-3 text-2xl font-semibold tracking-normal">
					{currentList?.name ?? 'List'}
				</h1>
				<p class="mt-1 text-sm text-muted-foreground">{listItems.length} issues</p>
			</div>

			{#if auth.user && currentList}
				<button
					type="button"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					onclick={openSearch}
				>
					<Plus class="size-4" />
					Add issues
				</button>
			{/if}
		</header>

		{#if auth.isLoading || listQuery.isLoading}
			<div class="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading list
			</div>
		{:else if !auth.user}
			<p class="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
				Sign in from the Library page to view lists.
			</p>
		{:else if listQuery.error}
			<p class="rounded-lg border border-border bg-card p-6 text-sm text-destructive">
				{listQuery.error.message}
			</p>
		{:else if !currentList}
			<p class="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
				List not found.
			</p>
		{:else}
			<ComicSearchPanel
				{addError}
				{addingIssueIds}
				{addingUserIssueIds}
				addedLabel="Added"
				bind:open={searchOpen}
				bind:query
				isInLibrary={isSearchIssueInList}
				isLibraryItemAdded={isLibraryItemInList}
				{isSearching}
				{libraryItems}
				onAddIssue={addIssue}
				onAddLibraryItem={addLibraryItem}
				onSearch={searchIssues}
				resultLimit={12}
				{results}
				{searchError}
				targetName={currentList.name}
			/>

			<section class="overflow-hidden rounded-lg border border-border bg-card">
				<div class="flex items-center justify-between border-b border-border px-4 py-3">
					<h2 class="font-semibold">{currentList.name}</h2>
					<span class="text-sm text-muted-foreground">{listItems.length} issues</span>
				</div>

				{#if listItems.length}
					<ul class="divide-y divide-border">
						{#each listItems as item (item.id)}
							{@const issue = item.userIssue?.issue}
							{#if issue}
								<li class="grid gap-4 p-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
									<img
										class="h-36 w-24 border border-border object-cover"
										src={issue.coverImageUrl ?? '/robots.txt'}
										alt=""
										style:view-transition-name={issueViewTransitionName(issue.id, 'cover')}
									/>
									<div class="min-w-0">
										<h3
											class="text-base font-semibold"
											style:view-transition-name={issueViewTransitionName(issue.id, 'title')}
										>
											<a class="underline-offset-4 hover:underline" href={`/issues/${issue.id}`}>
												{issueTitle(item)}
											</a>
										</h3>
										<p class="mt-1 text-sm text-muted-foreground">
											{issue.volume?.publisher?.name ?? 'Unknown publisher'} · {formatDate(
												issue.coverDate
											)}
										</p>
										{#if issue.summary}
											<p class="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
												{issue.summary}
											</p>
										{/if}
									</div>
								</li>
							{/if}
						{/each}
					</ul>
				{:else}
					<div class="grid gap-3 px-4 py-12 text-center">
						<p class="text-sm text-muted-foreground">
							Add issues from your Library, or search ComicVine for something new.
						</p>
						<button
							type="button"
							class="mx-auto inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
							onclick={openSearch}
						>
							<Plus class="size-4" />
							Add issues
						</button>
					</div>
				{/if}
			</section>
		{/if}
	</section>
</main>
