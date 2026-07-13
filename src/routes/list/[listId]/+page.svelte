<script lang="ts">
	import { id } from '@instantdb/svelte';
	import { ArrowLeft, EllipsisVertical, LoaderCircle, Pencil, Plus, Trash2 } from '@lucide/svelte';
	import { createSearchParamsSchema, useSearchParams } from 'runed/kit';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import ComicSearchPanel from '$lib/features/search/ComicSearchPanel.svelte';
	import { ComicSearchState } from '$lib/features/search/comic-search-state.svelte';
	import { Button } from '$lib/components/ui/button';
	import { confirmDelete } from '$lib/components/ui/confirm-delete-dialog';
	import * as Rename from '$lib/components/ui/rename';
	import IssueListPanel from '$lib/features/issues/IssueListPanel.svelte';
	import {
		IssueListView,
		isIssueListViewMode,
		resolvedIssueListViewMode,
		saveIssueListViewMode,
		storedIssueListViewMode,
		type IssueListViewMode
	} from '$lib/features/issues/view-mode';
	import * as Popover from '$lib/components/ui/popover';
	import {
		customListItemKey,
		isDuplicateListItemError,
		listHasCollectionItem,
		listHasSearchIssue,
		stableUserIssueKey,
		validateListName
	} from '$lib/features/lists/lists';
	import {
		IssueSort,
		isAllowedIssueSortKey,
		resolvedIssueSortKey,
		type IssueSortKey
	} from '$lib/features/issues/sort';
	import type { CollectionItem, SearchIssue, UserIssuePatch } from '$lib/comics/types';
	import { db } from '$lib/db';
	import { goto } from '$app/navigation';

	type UserList = {
		id: string;
		listKey: string;
		name: string;
		sortKey?: string | null;
		items: CollectionItem[];
	};

	let { params }: PageProps = $props();
	const listSearchParams = useSearchParams(
		createSearchParamsSchema({
			view: { type: 'string', default: '' },
			sort: { type: 'string', default: '' }
		}),
		{ pushHistory: false, noScroll: true }
	);

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

	const comicSearch = new ComicSearchState();
	let addError = $state<string | null>(null);
	let searchOpen = $state(false);
	let addingIssueIds = $state<number[]>([]);
	let addingUserIssueIds = $state<string[]>([]);
	let listMenuOpen = $state(false);
	let isDeletingList = $state(false);
	let listActionError = $state<string | null>(null);
	let syncedSortSignature = $state('');
	let renameMode = $state<'edit' | 'view'>('view');
	let removingItemIds = $state<string[]>([]);
	let shortcutModifier = $state('⌘');

	const currentList = $derived((listQuery.data?.userLists?.[0] as UserList | undefined) ?? null);
	const listItems = $derived(
		((currentList?.items ?? []) as CollectionItem[]).filter((item) => item.userIssue?.issue)
	);
	const filteredListItems = $derived(listItems);
	const listSortKey = $derived(
		resolvedIssueSortKey(listSearchParams.sort, currentList?.sortKey, IssueSort.Custom)
	);
	const listViewMode = $derived(
		resolvedIssueListViewMode(
			listSearchParams.view,
			currentList ? storedIssueListViewMode(listViewStorageKey(currentList.id)) : null,
			IssueListView.Gallery
		)
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
		renameMode = 'edit';
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

	async function readJsonResponse(response: Response) {
		try {
			return (await response.json()) as { results?: SearchIssue[]; error?: string };
		} catch {
			return {};
		}
	}

	async function addCollectionItem(item: CollectionItem) {
		const list = currentList;
		const userIssueId = item.userIssue?.id;
		const comicVineId = item.userIssue?.issue?.comicVineId;

		if (!list || !userIssueId) return false;
		if (isCollectionItemInList(item)) return true;

		if (!auth.user || typeof comicVineId !== 'number') {
			addError = 'This issue cannot be added to the list.';
			return false;
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
			return true;
		} catch (error) {
			if (isDuplicateListItemError(error)) {
				return true;
			}

			addError = error instanceof Error ? error.message : 'Unable to add issue to this list.';
			return false;
		} finally {
			addingUserIssueIds = addingUserIssueIds.filter((idValue) => idValue !== userIssueId);
		}
	}

	async function addIssue(issue: SearchIssue) {
		const collectionItem = collectionItemByComicVineId.get(issue.id);

		if (collectionItem) {
			return addCollectionItem(collectionItem);
		}

		if (isSearchIssueInList(issue)) {
			return true;
		}

		if (!auth.user?.refresh_token || !currentList) {
			addError = 'Sign in before adding issues.';
			return false;
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
			return true;
		} catch (error) {
			addError = error instanceof Error ? error.message : 'Unable to add issue.';
			return false;
		} finally {
			addingIssueIds = addingIssueIds.filter((idValue) => idValue !== issue.id);
		}
	}

	async function renameList(name: string) {
		const list = currentList;
		if (!list) return false;
		listActionError = null;

		try {
			await db.transact(
				db.tx.userLists[list.id].update({
					name: name.trim(),
					updatedAt: new Date()
				})
			);
			return true;
		} catch (error) {
			listActionError = error instanceof Error ? error.message : 'Unable to rename this list.';
			return false;
		}
	}

	async function updateListSortKey(listId: string, sortKey: IssueSortKey) {
		listActionError = null;

		try {
			await db.transact(
				db.tx.userLists[listId].update({
					sortKey,
					updatedAt: new Date()
				})
			);
		} catch (error) {
			listActionError = error instanceof Error ? error.message : 'Unable to update list sort.';
		}
	}

	function changeListViewMode(viewMode: IssueListViewMode) {
		listSearchParams.view = viewMode;
	}

	function changeListSortKey(sortKey: IssueSortKey) {
		listSearchParams.sort = sortKey;
	}

	async function deleteList() {
		const list = currentList;
		if (!list || isDeletingList) return;

		isDeletingList = true;
		listActionError = null;

		try {
			await db.transact(db.tx.userLists[list.id].delete());
			await goto('/');
		} catch (error) {
			listActionError = error instanceof Error ? error.message : 'Unable to delete this list.';
			throw error;
		} finally {
			isDeletingList = false;
		}
	}

	function confirmListDeletion() {
		const list = currentList;
		if (!list) return;

		listMenuOpen = false;
		listActionError = null;
		confirmDelete({
			title: 'Delete list',
			description:
				'This action cannot be undone. Your list will be deleted, but its issues will remain in your collection.',
			input: { confirmationText: list.name },
			onConfirm: deleteList
		});
	}

	async function removeListItem(itemId: string) {
		if (removingItemIds.includes(itemId)) return;

		listActionError = null;
		removingItemIds = [...removingItemIds, itemId];

		try {
			await db.transact(db.tx.userListItems[itemId].delete());
		} catch (error) {
			listActionError = error instanceof Error ? error.message : 'Unable to remove this issue.';
			throw error;
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
		if (!list || listSortKey !== IssueSort.Custom) return;

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

	function listViewStorageKey(listId: string) {
		return `longbox.list.${listId}.view`;
	}

	function persistListSortKey(list: UserList, sortKey: IssueSortKey) {
		const signature = `${list.id}:${sortKey}:${list.sortKey ?? ''}`;
		if (list.sortKey === sortKey || syncedSortSignature === signature) return;

		syncedSortSignature = signature;
		void updateListSortKey(list.id, sortKey);
	}

	$effect(() => {
		const list = currentList;
		if (!list) return;
		const viewMode = listSearchParams.view;
		const sortKey = listSearchParams.sort;
		const savedViewMode = storedIssueListViewMode(listViewStorageKey(list.id));

		if (!viewMode && savedViewMode) {
			listSearchParams.view = savedViewMode;
		} else if (isIssueListViewMode(viewMode)) {
			saveIssueListViewMode(listViewStorageKey(list.id), viewMode);
		}

		if (!sortKey && isAllowedIssueSortKey(list.sortKey, true)) {
			listSearchParams.sort = list.sortKey;
		} else if (isAllowedIssueSortKey(sortKey, true)) {
			persistListSortKey(list, sortKey);
		}
	});
</script>

<svelte:head>
	<title>{currentList?.name ?? 'List'} · Longbox</title>
</svelte:head>

<svelte:document onkeydown={handleKeydown} />

<main class="min-h-screen bg-background text-foreground">
	<section class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
		<header class="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
			<div class="min-w-0">
				<a
					class="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
					href="/"
				>
					<ArrowLeft class="size-4" />
					Collection
				</a>
				<div class="mt-3 flex min-w-0 items-center gap-1">
					<h1 class="min-w-0">
						{#if currentList}
							<Rename.Root
								this="span"
								bind:mode={renameMode}
								value={currentList.name}
								validate={(name) => !validateListName(name.trim(), existingListNames, currentList.name)}
								class="w-auto max-w-full text-2xl font-semibold tracking-normal"
								inputClass="h-9 px-2"
								textClass="truncate"
								onSave={renameList}
							/>
						{:else}
							<span class="text-2xl font-semibold tracking-normal">List</span>
						{/if}
					</h1>

					{#if auth.user && currentList}
						<Popover.Root bind:open={listMenuOpen}>
							<Popover.Trigger aria-label="Open list actions" size="icon-sm" variant="ghost">
								<EllipsisVertical />
							</Popover.Trigger>
							<Popover.Content class="w-max p-1.5" align="start">
								<Button class="w-full justify-start" onclick={renameCurrentList} variant="ghost">
									<Pencil data-icon="inline-start" />
									Rename list
								</Button>
								<Button
									aria-label="Delete list"
									class="w-full justify-start"
									disabled={isDeletingList}
									onclick={confirmListDeletion}
									variant="destructive"
								>
									<Trash2 data-icon="inline-start" />
									Delete list
								</Button>
							</Popover.Content>
						</Popover.Root>
					{/if}
				</div>
				<p class="mt-1 text-sm text-muted-foreground">{listItems.length} issues</p>
				{#if allListsQuery.error}
					<p class="mt-2 text-sm text-destructive">{allListsQuery.error.message}</p>
				{/if}
			</div>

			{#if auth.user && currentList}
				<div>
					<Button onclick={openSearch} size="lg">
						<Plus data-icon="inline-start" />
						Add issues
						<span class="ml-1 hidden items-center gap-1 text-xs text-primary-foreground/70 sm:flex">
							<kbd class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium">
								{shortcutModifier}
							</kbd>
							<kbd class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium">
								K
							</kbd>
						</span>
					</Button>
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
					isInCollection={isSearchIssueInList}
					isCollectionItemAdded={isCollectionItemInList}
					{collectionItems}
					onAddIssue={addIssue}
					onAddCollectionItem={addCollectionItem}
					search={comicSearch}
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
				sortKey={listSortKey}
				viewMode={listViewMode}
				onRemoveListItem={removeListItem}
				removeFromList
				onReorderItems={reorderListItems}
				onSortKeyChange={changeListSortKey}
				onUpdateUserIssue={updateUserIssue}
				onViewModeChange={changeListViewMode}
				{removingItemIds}
				userSortable
			>
				<!-- Inline list search is disabled while search is not URL-backed. -->

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
