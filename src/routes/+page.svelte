<script lang="ts">
	import { id } from '@instantdb/svelte';
	import { LoaderCircle } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/features/main-page/AppHeader.svelte';
	import AuthGate from '$lib/features/auth/AuthGate.svelte';
	import ComicSearchPanel from '$lib/features/search/ComicSearchPanel.svelte';
	import CreateListDialog from '$lib/features/lists/CreateListDialog.svelte';
	import CollectionPanel from '$lib/features/main-page/CollectionPanel.svelte';
	import ListsPanel from '$lib/features/main-page/ListsPanel.svelte';
	import OverviewPanel from '$lib/features/main-page/OverviewPanel.svelte';
	import {
		validateListName,
		type CustomListSummary
	} from '$lib/features/lists/lists';
	import SaveAccountDialog from '$lib/features/auth/SaveAccountDialog.svelte';
	import type { CollectionItem, SearchIssue } from '$lib/comics/types';
	import { COLLECTION_NAME } from '$lib/collection';
	import { db } from '$lib/db';

	const auth = db.useAuth();
	const collection = db.useQuery(() =>
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
			: null
	);
	const lists = db.useQuery(() =>
		auth.user
			? {
					userLists: {
						$: {
							where: {
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
								issue: {}
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
	let authError = $state<string | null>(null);
	let authEmail = $state('');
	let authCode = $state('');
	let authCodeSent = $state(false);
	let isSearching = $state(false);
	let isSigningIn = $state(false);
	let searchOpen = $state(false);
	let saveAccountOpen = $state(false);
	let saveAccountEmail = $state('');
	let saveAccountCode = $state('');
	let saveAccountCodeSent = $state(false);
	let saveAccountError = $state<string | null>(null);
	let isSavingAccount = $state(false);
	let addingIssueIds = $state<number[]>([]);
	let createListOpen = $state(false);
	let createListName = $state('');
	let createListError = $state<string | null>(null);
	let isCreatingList = $state(false);
	let collectionActionError = $state<string | null>(null);
	let removingCollectionIssueIds = $state<string[]>([]);

	let collectionItems = $derived.by(() =>
		(collection.data?.userIssues ?? [])
			.filter((userIssue) => userIssue.issue)
			.map(
				(userIssue): CollectionItem => ({
					id: userIssue.id,
					userIssue
				})
			)
	);
	let collectionComicVineIds = $derived(
		new Set(
			collectionItems
				.map((item) => item.userIssue?.issue?.comicVineId)
				.filter((id): id is number => typeof id === 'number')
		)
	);
	let favoriteCount = $derived(
		collectionItems.filter((item) => item.userIssue?.favorite === true).length
	);
	let watchlistCount = $derived(
		collectionItems.filter((item) => item.userIssue?.readStatus === 'unread').length
	);
	let readCount = $derived(
		collectionItems.filter((item) => item.userIssue?.readStatus === 'read').length
	);
	let customLists = $derived.by(() => {
		const userLists = lists.data?.userLists ?? [];

		return userLists
			.filter((list) => list.name !== COLLECTION_NAME)
			.sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime())
			.map(
				(list): CustomListSummary => ({
					coverImageUrls: list.items
						.map((item) => item.userIssue?.issue?.coverImageUrl)
						.filter((url): url is string => Boolean(url))
						.slice(0, 5),
					createdAt: list.createdAt,
					id: list.id,
					issueCount: list.items.length,
					name: list.name,
					updatedAt: list.updatedAt
				})
			);
	});

	function isInCollection(issue: SearchIssue) {
		return collectionComicVineIds.has(issue.id);
	}

	function openSearch() {
		searchOpen = true;
	}

	function openSaveAccount() {
		saveAccountError = null;
		saveAccountOpen = true;
	}

	function openCreateList() {
		if (createListOpen || isCreatingList) {
			return;
		}

		createListName = '';
		createListError = null;
		createListOpen = true;
	}

	function closeCreateList() {
		if (isCreatingList) {
			return;
		}

		createListOpen = false;
		createListName = '';
		createListError = null;
	}

	async function createList() {
		if (!auth.user || isCreatingList) {
			return;
		}

		const trimmedName = createListName.trim();
		const validationError = validateListName(
			trimmedName,
			customLists.map((list) => list.name)
		);
		createListError = validationError;

		if (validationError) {
			return;
		}

		isCreatingList = true;
		const listId = id();
		const now = new Date();

		try {
			await db.transact(
				db.tx.userLists[listId]
					.update({
						createdAt: now,
						listKey: `${auth.user.id}:custom:${listId}`,
						name: trimmedName,
						updatedAt: now
					})
					.link({ owner: auth.user.id })
			);
			createListOpen = false;
			createListName = '';
			await goto(`/list/${listId}`);
		} catch (error) {
			createListError = error instanceof Error ? error.message : 'Unable to create this list.';
		} finally {
			isCreatingList = false;
		}
	}

	async function renameList(listId: string, name: string) {
		await db.transact(
			db.tx.userLists[listId].update({
				name,
				updatedAt: new Date()
			})
		);
	}

	async function deleteList(list: CustomListSummary) {
		await db.transact(db.tx.userLists[list.id].delete());
	}

	async function removeCollectionIssue(itemId: string) {
		if (removingCollectionIssueIds.includes(itemId)) return;

		collectionActionError = null;
		removingCollectionIssueIds = [...removingCollectionIssueIds, itemId];

		try {
			await db.transact(db.tx.userIssues[itemId].delete());
		} catch (error) {
			collectionActionError =
				error instanceof Error ? error.message : 'Unable to remove this issue.';
		} finally {
			removingCollectionIssueIds = removingCollectionIssueIds.filter((id) => id !== itemId);
		}
	}

	function backToSaveAccountEmail() {
		saveAccountCode = '';
		saveAccountCodeSent = false;
		saveAccountError = null;
	}

	function backToAuthEmail() {
		authCode = '';
		authCodeSent = false;
		authError = null;
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if (!auth.user || event.defaultPrevented || event.key.toLowerCase() !== 'k') {
			return;
		}

		if (event.metaKey || event.ctrlKey) {
			event.preventDefault();
			openSearch();
		}
	}

	async function readJsonResponse(response: Response) {
		try {
			return (await response.json()) as { results?: SearchIssue[]; error?: string };
		} catch {
			return {};
		}
	}

	async function signInAsGuest() {
		authError = null;
		isSigningIn = true;

		try {
			await db.auth.signInAsGuest();
		} catch (error) {
			authError = error instanceof Error ? error.message : 'Unable to sign in.';
		} finally {
			isSigningIn = false;
		}
	}

	async function sendAuthCode() {
		const trimmedEmail = authEmail.trim();
		authError = null;

		if (!trimmedEmail) {
			authError = 'Enter an email address.';
			return;
		}

		isSigningIn = true;

		try {
			await db.auth.sendMagicCode({ email: trimmedEmail });
			authEmail = trimmedEmail;
			authCode = '';
			authCodeSent = true;
		} catch (error) {
			authError = error instanceof Error ? error.message : 'Unable to send a sign-in code.';
		} finally {
			isSigningIn = false;
		}
	}

	async function signInWithCode() {
		const trimmedCode = authCode.trim();
		authError = null;

		if (!trimmedCode) {
			authError = 'Enter the code from your email.';
			return;
		}

		isSigningIn = true;

		try {
			await db.auth.signInWithMagicCode({
				email: authEmail,
				code: trimmedCode
			});
			authEmail = '';
			authCode = '';
			authCodeSent = false;
		} catch (error) {
			authError = error instanceof Error ? error.message : 'Unable to sign in.';
			authCode = '';
		} finally {
			isSigningIn = false;
		}
	}

	async function sendSaveAccountCode() {
		const trimmedEmail = saveAccountEmail.trim();
		saveAccountError = null;

		if (!trimmedEmail) {
			saveAccountError = 'Enter an email address.';
			return;
		}

		isSavingAccount = true;

		try {
			await db.auth.sendMagicCode({ email: trimmedEmail });
			saveAccountEmail = trimmedEmail;
			saveAccountCode = '';
			saveAccountCodeSent = true;
		} catch (error) {
			saveAccountError = error instanceof Error ? error.message : 'Unable to send a sign-in code.';
		} finally {
			isSavingAccount = false;
		}
	}

	async function saveGuestAccount() {
		const trimmedCode = saveAccountCode.trim();
		saveAccountError = null;

		if (!trimmedCode) {
			saveAccountError = 'Enter the code from your email.';
			return;
		}

		isSavingAccount = true;

		try {
			await db.auth.signInWithMagicCode({
				email: saveAccountEmail,
				code: trimmedCode
			});
			saveAccountOpen = false;
			saveAccountEmail = '';
			saveAccountCode = '';
			saveAccountCodeSent = false;
		} catch (error) {
			saveAccountError = error instanceof Error ? error.message : 'Unable to save this account.';
			saveAccountCode = '';
		} finally {
			isSavingAccount = false;
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

	async function addIssue(issue: SearchIssue) {
		if (isInCollection(issue) || addingIssueIds.includes(issue.id)) {
			return;
		}

		if (!auth.user?.refresh_token) {
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
				body: JSON.stringify({ issueId: issue.id })
			});
			const body = await readJsonResponse(response);

			if (!response.ok) {
				throw new Error(body.error ?? 'Unable to add issue.');
			}
		} catch (error) {
			addError = error instanceof Error ? error.message : 'Unable to add issue.';
		} finally {
			addingIssueIds = addingIssueIds.filter((id) => id !== issue.id);
		}
	}
</script>

<svelte:head>
	<title>Longbox</title>
</svelte:head>

<svelte:document onkeydown={handleGlobalKeydown} />

<main class="min-h-screen bg-background text-foreground">
	<section class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
		<AppHeader
			isGuest={Boolean(auth.user?.isGuest)}
			signedIn={Boolean(auth.user)}
			onOpenSearch={openSearch}
			onSaveAccount={openSaveAccount}
			onSignOut={() => db.auth.signOut()}
		/>

		{#if auth.isLoading}
			<div class="flex min-h-96 items-center justify-center text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading collection
			</div>
		{:else if !auth.user}
			<AuthGate
				bind:code={authCode}
				bind:email={authEmail}
				authError={authError ?? auth.error?.message ?? null}
				codeSent={authCodeSent}
				{isSigningIn}
				onBackToEmail={backToAuthEmail}
				onSignInAsGuest={signInAsGuest}
				onSubmitCode={signInWithCode}
				onSubmitEmail={sendAuthCode}
			/>
		{:else}
			<ComicSearchPanel
				{addError}
				{addingIssueIds}
				bind:open={searchOpen}
				bind:query
				{isInCollection}
				{isSearching}
				onAddIssue={addIssue}
				onSearch={searchIssues}
				resultLimit={12}
				{results}
				{searchError}
			/>

			{#if auth.user?.isGuest}
				<SaveAccountDialog
					bind:code={saveAccountCode}
					bind:email={saveAccountEmail}
					bind:open={saveAccountOpen}
					codeSent={saveAccountCodeSent}
					errorMessage={saveAccountError}
					isSubmitting={isSavingAccount}
					onBackToEmail={backToSaveAccountEmail}
					onSubmitCode={saveGuestAccount}
					onSubmitEmail={sendSaveAccountCode}
				/>
			{/if}

			<CreateListDialog
				errorMessage={createListError}
				bind:name={createListName}
				bind:open={createListOpen}
				isSubmitting={isCreatingList}
				onCancel={closeCreateList}
				onSubmit={createList}
			/>

			<OverviewPanel
				{favoriteCount}
				issueCount={collectionItems.length}
				listCount={customLists.length}
				{readCount}
				{watchlistCount}
			/>

			<ListsPanel
				{customLists}
				errorMessage={lists.error?.message ?? null}
				isLoading={lists.isLoading}
				onCreateList={openCreateList}
				onDeleteList={deleteList}
				onRenameList={renameList}
			/>

			<CollectionPanel
				errorMessage={collectionActionError ?? collection.error?.message ?? null}
				isLoading={collection.isLoading}
				items={collectionItems}
				onAddIssue={openSearch}
				onRemoveIssue={removeCollectionIssue}
				removingItemIds={removingCollectionIssueIds}
			/>
		{/if}
	</section>
</main>
