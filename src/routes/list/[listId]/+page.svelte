<script lang="ts">
	import { id } from '@instantdb/svelte';
	import { ArrowLeft, EllipsisVertical, LoaderCircle, Pencil, Plus, Search, Trash2 } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import ComicSearchPanel from '$lib/features/search/ComicSearchPanel.svelte';
	import DeleteListDialog from '$lib/features/lists/DeleteListDialog.svelte';
	import InlineListTitle from '$lib/features/lists/InlineListTitle.svelte';
	import IssueListPanel from '$lib/features/issues/IssueListPanel.svelte';
	import {
		storedIssueListViewMode,
		storeIssueListViewMode,
		type IssueListViewMode
	} from '$lib/features/issues/view-mode';
	import * as Popover from '$lib/components/ui/popover';
	import {
		customListItemKey,
		isDuplicateListItemError,
		listHasCollectionItem,
		listHasSearchIssue,
		stableUserIssueKey
	} from '$lib/features/lists/lists';
	import type { CollectionItem, SearchIssue, UserIssuePatch } from '$lib/comics/types';
	import { db } from '$lib/db';
	import { goto } from '$app/navigation';

	type UserList = {
		id: string;
		listKey: string;
		name: string;
		items: CollectionItem[];
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
								},
								listItems: {
									list: {}
								}
							}
						}
					}
				}
			: null
	);
	const collectionQuery = db.useQuery(() =>
		auth.user
			? {
					userIssues: {
						$: {
							where: {
								'owner.id': auth.user.id
							}
						},
						issue: {
							volume: {
								publisher: {}
							}
						},
						listItems: {
							list: {}
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
	let listMenuOpen = $state(false);
	let isDeletingList = $state(false);
	let listActionError = $state<string | null>(null);
	let listSearchQuery = $state('');
	let listViewMode = $state<IssueListViewMode>(storedIssueListViewMode());
	let pageTitle = $state<InlineListTitle | null>(null);
	let removingItemIds = $state<string[]>([]);
	let shortcutModifier = $state('⌘');

	const currentList = $derived((listQuery.data?.userLists?.[0] as UserList | undefined) ?? null);
	const listItems = $derived(
		((currentList?.items ?? []) as CollectionItem[]).filter((item) => item.userIssue?.issue)
	);
	const filteredListItems = $derived(
		listSearchQuery.trim()
			? listItems.filter((item) => listItemSearchText(item).includes(listSearchQuery.trim().toLowerCase()))
			: listItems
	);
	const collectionItems = $derived(
		(collectionQuery.data?.userIssues ?? [])
			.filter((userIssue) => userIssue.issue)
			.map(
				(userIssue): CollectionItem => ({
					id: userIssue.id,
					userIssue
				})
			)
	);
	const collectionItemByComicVineId = $derived(
		new Map(
			collectionItems
				.map((item) => [item.userIssue?.issue?.comicVineId, item] as const)
				.filter((entry): entry is readonly [number, CollectionItem] => typeof entry[0] === 'number')
		)
	);
	const existingListNames = $derived((allListsQuery.data?.userLists ?? []).map((list) => list.name));

	onMount(() => {
		if (!/(Mac|iPhone|iPad|iPod)/.test(navigator.platform)) {
			shortcutModifier = 'Ctrl';
		}
	});

	function openSearch() {
		searchOpen = true;
	}

	function renameCurrentList() {
		listMenuOpen = false;
		void pageTitle?.startEditing();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!auth.user || !currentList || event.defaultPrevented || (!event.metaKey && !event.ctrlKey)) {
			return;
		}

		if (event.key.toLowerCase() === 'k') {
			event.preventDefault();
			openSearch();
		}
	}

	function isSearchIssueInList(issue: SearchIssue) {
		return listHasSearchIssue(listItems, issue, addingIssueIds);
	}

	function isCollectionItemInList(item: CollectionItem) {
		return listHasCollectionItem(listItems, item, addingUserIssueIds);
	}

	function listItemSearchText(item: CollectionItem) {
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

	function closeListSearch() {
		listSearchQuery = '';
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

	async function addCollectionItem(item: CollectionItem) {
		const list = currentList;
		const userIssueId = item.userIssue?.id;
		const comicVineId = item.userIssue?.issue?.comicVineId;

		if (!list || !userIssueId || isCollectionItemInList(item)) {
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
		const collectionItem = collectionItemByComicVineId.get(issue.id);

		if (collectionItem) {
			await addCollectionItem(collectionItem);
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
			const response = await fetch('/api/collection/add', {
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

	async function updateUserIssue(userIssueId: string, patch: UserIssuePatch) {
		listActionError = null;

		try {
			await db.transact(
				db.tx.userIssues[userIssueId].update({
					...patch,
					updatedAt: new Date()
				})
			);
		} catch (error) {
			listActionError = error instanceof Error ? error.message : 'Unable to update this issue.';
		}
	}

	async function reorderListItems(orderedItems: CollectionItem[]) {
		const list = currentList;
		if (!list || listSearchQuery.trim()) return;

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

<svelte:document onkeydown={handleKeydown} />

<main class="min-h-screen bg-background text-foreground">
	<section class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
		<header class="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<a
					class="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
					href="/"
				>
					<ArrowLeft class="size-4" />
					Collection
				</a>
				<h1 class="mt-3">
					{#if currentList}
						<InlineListTitle
							bind:this={pageTitle}
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
						<span class="ml-1 hidden items-center gap-1 text-xs text-primary-foreground/70 sm:flex">
							<kbd class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium">
								{shortcutModifier}
							</kbd>
							<kbd class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium">
								K
							</kbd>
						</span>
					</button>
					<Popover.Root bind:open={listMenuOpen}>
						<Popover.Trigger
							type="button"
							class="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
							aria-label="Open list actions"
						>
							<EllipsisVertical class="size-4" />
						</Popover.Trigger>
						<Popover.Content class="w-max p-1.5" align="end">
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-muted"
								onclick={renameCurrentList}
							>
								<Pencil class="size-4" />
								Rename list
							</button>
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
								onclick={() => {
									listMenuOpen = false;
									deleteListError = null;
									deleteListOpen = true;
								}}
							>
								<Trash2 class="size-4" />
								Delete list
							</button>
						</Popover.Content>
					</Popover.Root>
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
				Sign in from the Collection page to view lists.
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
			{#if collectionQuery.isLoading}
				<div class="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
					<LoaderCircle class="mr-2 inline size-4 animate-spin" />
					Loading collection issues
				</div>
			{:else if collectionQuery.error}
				<p class="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
					{collectionQuery.error.message}
				</p>
			{:else}
				<ComicSearchPanel
					{addError}
					{addingIssueIds}
					{addingUserIssueIds}
					addedLabel="Added"
					bind:open={searchOpen}
					bind:query
					isInCollection={isSearchIssueInList}
					isCollectionItemAdded={isCollectionItemInList}
					{isSearching}
					{collectionItems}
					onAddIssue={addIssue}
					onAddCollectionItem={addCollectionItem}
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
			<IssueListPanel
				currentListId={currentList.id}
				items={filteredListItems}
				viewMode={listViewMode}
				onRemoveListItem={removeListItem}
				onReorderItems={listSearchQuery.trim() ? undefined : reorderListItems}
				onUpdateUserIssue={updateUserIssue}
				onViewModeChange={(viewMode) => {
					listViewMode = viewMode;
					storeIssueListViewMode(viewMode);
				}}
				{removingItemIds}
			>
				{#snippet controls()}
					<div class="relative size-9">
						<div
							class={`group absolute -right-1 -top-1 z-10 flex h-11 items-center p-1 transition-[width] duration-200 ease-out hover:w-[16.5rem] focus-within:w-[16.5rem] ${
								listSearchQuery.trim() ? 'w-[16.5rem]' : 'w-11'
							}`}
						>
							<div class="relative flex h-9 w-full items-center overflow-hidden rounded-md">
								<div
									class={`pointer-events-none absolute inset-0 rounded-md bg-muted transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100 ${
										listSearchQuery.trim() ? 'opacity-100' : 'opacity-0'
									}`}
								></div>
								<div class="pointer-events-none relative inline-flex size-9 shrink-0 items-center justify-center text-muted-foreground">
									<Search class="size-4" />
								</div>
								<input
									class={`relative h-9 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none transition-opacity duration-150 placeholder:text-muted-foreground focus:border-transparent focus:ring-0 group-hover:opacity-100 group-focus-within:opacity-100 ${
										listSearchQuery.trim() ? 'opacity-100' : 'opacity-0'
									}`}
									aria-label="Search list"
									placeholder="Search list"
									bind:value={listSearchQuery}
									onkeydown={(event) => {
										if (event.key === 'Escape') {
											closeListSearch();
										}
									}}
								/>
							</div>
						</div>
					</div>
				{/snippet}

				{#snippet empty()}
					<div class="grid gap-3 px-4 py-12 text-center">
						<p class="text-sm text-muted-foreground">
							Add issues from your Collection, or search ComicVine for something new.
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
				{/snippet}
			</IssueListPanel>
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
