<script lang="ts">
	import { LoaderCircle } from '@lucide/svelte';
	import AppHeader from '$lib/components/library/AppHeader.svelte';
	import AuthGate from '$lib/components/library/AuthGate.svelte';
	import ComicSearchPanel from '$lib/components/library/ComicSearchPanel.svelte';
	import LibraryPanel from '$lib/components/library/LibraryPanel.svelte';
	import type { LibraryItem, SearchIssue } from '$lib/comics/types';
	import { db } from '$lib/db';

	const auth = db.useAuth();
	const library = db.useQuery(() =>
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

	let query = $state('');
	let results = $state<SearchIssue[]>([]);
	let searchError = $state<string | null>(null);
	let addError = $state<string | null>(null);
	let authError = $state<string | null>(null);
	let isSearching = $state(false);
	let isSigningIn = $state(false);
	let searchOpen = $state(false);
	let addingIssueIds = $state<number[]>([]);

	let libraryItems = $derived(
		((library.data?.userLists?.[0]?.items ?? []) as LibraryItem[]).filter(
			(item) => item.userIssue?.issue
		)
	);
	let libraryComicVineIds = $derived(
		new Set(
			libraryItems
				.map((item) => item.userIssue?.issue?.comicVineId)
				.filter((id): id is number => typeof id === 'number')
		)
	);

	function isInLibrary(issue: SearchIssue) {
		return libraryComicVineIds.has(issue.id);
	}

	function openSearch() {
		searchOpen = true;
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
		if (isInLibrary(issue)) {
			return;
		}

		if (!auth.user?.refresh_token) {
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
			signedIn={Boolean(auth.user)}
			onOpenSearch={openSearch}
			onSignOut={() => db.auth.signOut()}
		/>

		{#if auth.isLoading}
			<div class="flex min-h-96 items-center justify-center text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading library
			</div>
		{:else if !auth.user}
			<AuthGate
				authError={authError ?? auth.error?.message ?? null}
				{isSigningIn}
				onSignIn={signInAsGuest}
			/>
		{:else}
			<ComicSearchPanel
				{addError}
				{addingIssueIds}
				bind:open={searchOpen}
				bind:query
				{isInLibrary}
				{isSearching}
				onAddIssue={addIssue}
				onSearch={searchIssues}
				resultLimit={12}
				{results}
				{searchError}
			/>

			<LibraryPanel
				errorMessage={library.error?.message ?? null}
				isLoading={library.isLoading}
				items={libraryItems}
			/>
		{/if}
	</section>
</main>
