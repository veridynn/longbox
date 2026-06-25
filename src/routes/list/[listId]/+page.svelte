<script lang="ts">
	import { id } from '@instantdb/svelte';
	import { ArrowLeft, LoaderCircle, Plus, Trash2 } from '@lucide/svelte';
	import type { PageProps } from './$types';
	import ComicSearchPanel from '$lib/components/library/ComicSearchPanel.svelte';
	import DeleteListDialog from '$lib/components/library/DeleteListDialog.svelte';
	import InlineListTitle from '$lib/components/library/InlineListTitle.svelte';
	import ListIssueRows from '$lib/components/library/ListIssueRows.svelte';
	import {
		customListItemKey,
		isDuplicateListItemError,
		listHasLibraryItem,
		listHasSearchIssue,
		stableUserIssueKey
	} from '$lib/components/library/lists';
	import type { LibraryItem, SearchIssue } from '$lib/comics/types';
	import { db } from '$lib/db';
	import { goto } from '$app/navigation';

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
	const allListsQuery = db.useQuery(() =>
		auth.user
			? {
					userLists: {
						$: {
							where: {
								'owner.id': auth.user.id
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
	let deleteListError = $state<string | null>(null);
	let deleteListOpen = $state(false);
	let isDeletingList = $state(false);
	let listActionError = $state<string | null>(null);
	let removingItemIds = $state<string[]>([]);

	const currentList = $derived((listQuery.data?.userLists?.[0] as UserList | undefined) ?? null);
	const listItems = $derived(
		((currentList?.items ?? []) as LibraryItem[]).filter((item) => item.userIssue?.issue)
	);
	const libraryItems = $derived(
		((libraryQuery.data?.userLists?.[0]?.items ?? []) as LibraryItem[]).filter(
			(item) => item.userIssue?.issue
		)
	);
	const libraryItemByComicVineId = $derived(
		new Map(
			libraryItems
				.map((item) => [item.userIssue?.issue?.comicVineId, item] as const)
				.filter((entry): entry is readonly [number, LibraryItem] => typeof entry[0] === 'number')
		)
	);
	const existingListNames = $derived((allListsQuery.data?.userLists ?? []).map((list) => list.name));

	function openSearch() {
		searchOpen = true;
	}

	function isSearchIssueInList(issue: SearchIssue) {
		return listHasSearchIssue(listItems, issue, addingIssueIds);
	}

	function isLibraryItemInList(item: LibraryItem) {
		return listHasLibraryItem(listItems, item, addingUserIssueIds);
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
		const comicVineId = item.userIssue?.issue?.comicVineId;

		if (!list || !userIssueId || isLibraryItemInList(item)) {
			return;
		}

		if (!auth.user || typeof comicVineId !== 'number') {
			addError = 'This issue cannot be added to the list.';
			return;
		}

		addError = null;
		addingUserIssueIds = [...addingUserIssueIds, userIssueId];

		try {
			await db.transact(
				db.tx.userListItems[id()]
					.update({
						addedAt: new Date(),
						listItemKey: customListItemKey(
							list.listKey,
							stableUserIssueKey(auth.user.id, comicVineId)
						),
						position: listItems.length
					})
					.link({
						list: list.id,
						userIssue: userIssueId
					})
			);
		} catch (error) {
			if (isDuplicateListItemError(error)) {
				return;
			}

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

	async function renameList(name: string) {
		const list = currentList;
		if (!list) return;

		await db.transact(
			db.tx.userLists[list.id].update({
				name,
				updatedAt: new Date()
			})
		);
	}

	function closeDeleteList() {
		if (isDeletingList) return;

		deleteListOpen = false;
		deleteListError = null;
	}

	async function deleteList() {
		const list = currentList;
		if (!list || isDeletingList) return;

		isDeletingList = true;
		deleteListError = null;

		try {
			await db.transact(db.tx.userLists[list.id].delete());
			await goto('/');
		} catch (error) {
			deleteListError = error instanceof Error ? error.message : 'Unable to delete this list.';
		} finally {
			isDeletingList = false;
		}
	}

	async function removeListItem(itemId: string) {
		if (removingItemIds.includes(itemId)) return;

		listActionError = null;
		removingItemIds = [...removingItemIds, itemId];

		try {
			await db.transact(db.tx.userListItems[itemId].delete());
		} catch (error) {
			listActionError = error instanceof Error ? error.message : 'Unable to remove this issue.';
		} finally {
			removingItemIds = removingItemIds.filter((idValue) => idValue !== itemId);
		}
	}

	async function reorderListItems(orderedItems: LibraryItem[]) {
		const list = currentList;
		if (!list) return;

		const positions = orderedItems
			.map((item, position) => ({ id: item.id, position }))
			.filter((item) => listItems.find((listItem) => listItem.id === item.id)?.position !== item.position);
		if (!positions.length) return;

		listActionError = null;

		try {
			await db.transact([
				...positions.map((item) => db.tx.userListItems[item.id].update({ position: item.position })),
				db.tx.userLists[list.id].update({ updatedAt: new Date() })
			]);
		} catch (error) {
			listActionError = error instanceof Error ? error.message : 'Unable to reorder this list.';
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
				<h1 class="mt-3">
					{#if currentList}
						<InlineListTitle
							class="text-2xl font-semibold tracking-normal"
							existingNames={existingListNames}
							isSubmitting={isDeletingList}
							name={currentList.name}
							onRename={renameList}
						/>
					{:else}
						<span class="text-2xl font-semibold tracking-normal">List</span>
					{/if}
				</h1>
				<p class="mt-1 text-sm text-muted-foreground">{listItems.length} issues</p>
				{#if allListsQuery.error}
					<p class="mt-2 text-sm text-destructive">{allListsQuery.error.message}</p>
				{/if}
			</div>

			{#if auth.user && currentList}
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						onclick={openSearch}
					>
						<Plus class="size-4" />
						Add issues
					</button>
					<button
						type="button"
						class="inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-destructive hover:bg-destructive/10"
						onclick={() => {
							deleteListError = null;
							deleteListOpen = true;
						}}
					>
						<Trash2 class="size-4" />
						Delete list
					</button>
				</div>
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
			{#if libraryQuery.isLoading}
				<div class="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
					<LoaderCircle class="mr-2 inline size-4 animate-spin" />
					Loading library issues
				</div>
			{:else if libraryQuery.error}
				<p class="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
					{libraryQuery.error.message}
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
			{/if}

			{#if listActionError}
				<p class="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
					{listActionError}
				</p>
			{/if}
			<section class="overflow-hidden rounded-lg border border-border bg-card">
				<div class="flex items-center justify-between border-b border-border px-4 py-3">
					<InlineListTitle
						class="font-semibold"
						existingNames={existingListNames}
						isSubmitting={isDeletingList}
						name={currentList.name}
						onRename={renameList}
					/>
					<span class="text-sm text-muted-foreground">{listItems.length} issues</span>
				</div>

				{#if listItems.length}
					<ListIssueRows
						items={listItems}
						onRemoveListItem={removeListItem}
						onReorderListItems={reorderListItems}
						{removingItemIds}
					/>
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

{#if currentList}
	<DeleteListDialog
		errorMessage={deleteListError}
		isSubmitting={isDeletingList}
		listName={currentList.name}
		bind:open={deleteListOpen}
		onCancel={closeDeleteList}
		onConfirm={deleteList}
	/>
{/if}
