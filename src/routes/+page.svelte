<script lang="ts">
	import { BookOpen, LoaderCircle, LogOut, Plus, Check, Search } from '@lucide/svelte';
	import { db } from '$lib/db';

	type SearchIssue = {
		id: number;
		name: string | null;
		issueNumber: string;
		coverDate: string | null;
		coverImageUrl: string | null;
		volume: {
			id: number | null;
			name: string | null;
		};
		siteDetailUrl: string | null;
	};

	type LibraryItem = {
		id: string;
		position: number;
		userIssue?: {
			id: string;
			issue?: {
				id: string;
				name?: string | null;
				issueNumber: string;
				comicVineId?: number | null;
				coverDate?: Date | null;
				coverImageUrl?: string | null;
				summary?: string | null;
				volume?: {
					id: string;
					name: string;
					publisher?: {
						id: string;
						name: string;
					} | null;
				} | null;
				issueCharacters?: Array<{
					id: string;
					character?: {
						id: string;
						name: string;
					} | null;
				}>;
				credits?: Array<{
					id: string;
					role: string;
					person?: {
						id: string;
						name: string;
					} | null;
				}>;
			} | null;
		} | null;
	};

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
	let addingIssueIds = $state<number[]>([]);

	let libraryItems = $derived(
		((library.data?.userLists?.[0]?.items ?? []) as LibraryItem[]).filter(
			(item) => item.userIssue?.issue
		)
	);
	let libraryComicVineIds = $derived(
		libraryItems
			.map((item) => item.userIssue?.issue?.comicVineId)
			.filter((id): id is number => typeof id === 'number')
	);

	function issueTitle(issue: SearchIssue) {
		const volumeName = issue.volume.name ?? 'Unknown volume';
		const issueName = issue.name ? `: ${issue.name}` : '';
		return `${volumeName} #${issue.issueNumber}${issueName}`;
	}

	function formatDate(date: string | Date | null | undefined) {
		if (!date) return 'Unknown date';

		const value = date instanceof Date ? date : new Date(`${date}T00:00:00.000Z`);
		if (Number.isNaN(value.valueOf())) return 'Unknown date';

		return new Intl.DateTimeFormat('en', {
			month: 'short',
			year: 'numeric'
		}).format(value);
	}

	function groupedCredits(item: LibraryItem) {
		const credits = item.userIssue?.issue?.credits ?? [];
		const byRole: Record<string, string[]> = {};

		for (const credit of credits) {
			const personName = credit.person?.name;
			if (!personName) continue;

			byRole[credit.role] = [...(byRole[credit.role] ?? []), personName];
		}

		return Object.entries(byRole)
			.slice(0, 4)
			.map(([role, names]) => `${role}: ${Array.from(new Set(names)).join(', ')}`);
	}

	function characterNames(item: LibraryItem) {
		return Array.from(
			new Set(
				(item.userIssue?.issue?.issueCharacters ?? [])
					.map((appearance) => appearance.character?.name)
					.filter((name): name is string => Boolean(name))
			)
		).slice(0, 6);
	}

	function isInLibrary(issue: SearchIssue) {
		return libraryComicVineIds.includes(issue.id);
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
			const body = (await response.json()) as { results?: SearchIssue[]; error?: string };

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
			const body = (await response.json()) as { error?: string };

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

<main class="min-h-screen bg-background text-foreground">
	<section class="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
		<header
			class="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-center md:justify-between"
		>
			<div class="flex items-center gap-3">
				<div
					class="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground"
				>
					<BookOpen class="size-5" />
				</div>
				<div>
					<h1 class="text-2xl font-semibold tracking-normal">Longbox</h1>
					<p class="text-sm text-muted-foreground">Search ComicVine and build your Library.</p>
				</div>
			</div>

			{#if auth.user}
				<button
					type="button"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
					onclick={() => db.auth.signOut()}
				>
					<LogOut class="size-4" />
					Sign out
				</button>
			{/if}
		</header>

		{#if auth.isLoading}
			<div class="flex min-h-96 items-center justify-center text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading library
			</div>
		{:else if !auth.user}
			<div class="grid min-h-96 place-items-center">
				<div class="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
					<h2 class="text-xl font-semibold">Start a local library</h2>
					<p class="mt-2 text-sm leading-6 text-muted-foreground">
						Use a guest Instant account to try ComicVine search and imports.
					</p>
					<button
						type="button"
						class="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
						disabled={isSigningIn}
						onclick={signInAsGuest}
					>
						{#if isSigningIn}
							<LoaderCircle class="size-4 animate-spin" />
							Signing in
						{:else}
							Continue as guest
						{/if}
					</button>
					{#if authError || auth.error}
						<p class="mt-3 text-sm text-destructive">{authError ?? auth.error?.message}</p>
					{/if}
				</div>
			</div>
		{:else}
			<div class="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
				<section class="flex flex-col gap-4">
					<form class="flex gap-2" onsubmit={(event) => (event.preventDefault(), searchIssues())}>
						<label class="sr-only" for="comic-search">Search comics</label>
						<div class="relative flex-1">
							<Search
								class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<input
								id="comic-search"
								bind:value={query}
								class="h-11 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
								placeholder="Search issues, volumes, or titles"
							/>
						</div>
						<button
							type="submit"
							class="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
							disabled={isSearching}
						>
							{#if isSearching}
								<LoaderCircle class="size-4 animate-spin" />
							{:else}
								<Search class="size-4" />
							{/if}
							Search
						</button>
					</form>

					{#if searchError}
						<p
							class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						>
							{searchError}
						</p>
					{/if}

					{#if addError}
						<p
							class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
						>
							{addError}
						</p>
					{/if}

					<div class="overflow-hidden rounded-lg border border-border bg-card">
						<div class="border-b border-border px-4 py-3">
							<h2 class="font-semibold">ComicVine results</h2>
						</div>

						{#if results.length}
							<ul class="divide-y divide-border">
								{#each results as issue (issue.id)}
									<li class="flex gap-3 p-3">
										<img
											class="h-28 w-20 shrink-0 rounded-md border border-border object-cover"
											src={issue.coverImageUrl ?? '/robots.txt'}
											alt=""
										/>
										<div class="min-w-0 flex-1">
											<h3 class="line-clamp-2 text-sm font-semibold">{issueTitle(issue)}</h3>
											<p class="mt-1 text-xs text-muted-foreground">
												{formatDate(issue.coverDate)}
											</p>
											{#if issue.siteDetailUrl}
												<a
													class="mt-2 inline-block text-xs font-medium text-foreground underline-offset-4 hover:underline"
													href={issue.siteDetailUrl}
													target="_blank"
													rel="noreferrer"
												>
													View on ComicVine
												</a>
											{/if}
										</div>
										<button
											type="button"
											class="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
											aria-label={isInLibrary(issue)
												? `${issueTitle(issue)} is already in Library`
												: `Add ${issueTitle(issue)} to Library`}
											disabled={addingIssueIds.includes(issue.id) || isInLibrary(issue)}
											onclick={() => addIssue(issue)}
										>
											{#if addingIssueIds.includes(issue.id)}
												<LoaderCircle class="size-4 animate-spin" />
											{:else if isInLibrary(issue)}
												<Check class="size-4" />
											{:else}
												<Plus class="size-4" />
											{/if}
										</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="px-4 py-12 text-center text-sm text-muted-foreground">
								Search for an exact issue to add it to your Library.
							</p>
						{/if}
					</div>
				</section>

				<section class="overflow-hidden rounded-lg border border-border bg-card">
					<div class="flex items-center justify-between border-b border-border px-4 py-3">
						<h2 class="font-semibold">Library</h2>
						<span class="text-sm text-muted-foreground">{libraryItems.length} issues</span>
					</div>

					{#if library.isLoading}
						<div class="flex min-h-80 items-center justify-center text-sm text-muted-foreground">
							<LoaderCircle class="mr-2 size-4 animate-spin" />
							Loading issues
						</div>
					{:else if library.error}
						<p class="px-4 py-6 text-sm text-destructive">{library.error.message}</p>
					{:else if libraryItems.length}
						<ul class="divide-y divide-border">
							{#each libraryItems as item (item.id)}
								{@const issue = item.userIssue?.issue}
								{#if issue}
									<li class="grid gap-4 p-4 sm:grid-cols-[6rem_minmax(0,1fr)]">
										<img
											class="h-36 w-24 rounded-md border border-border object-cover"
											src={issue.coverImageUrl ?? '/robots.txt'}
											alt=""
										/>
										<div class="min-w-0">
											<div class="flex flex-wrap items-start justify-between gap-3">
												<div>
													<h3 class="text-base font-semibold">
														{issue.volume?.name ?? 'Unknown volume'} #{issue.issueNumber}{issue.name
															? `: ${issue.name}`
															: ''}
													</h3>
													<p class="mt-1 text-sm text-muted-foreground">
														{issue.volume?.publisher?.name ?? 'Unknown publisher'} · {formatDate(
															issue.coverDate
														)}
													</p>
												</div>
											</div>

											{#if issue.summary}
												<p class="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
													{issue.summary}
												</p>
											{/if}

											<div class="mt-4 grid gap-3 md:grid-cols-2">
												<div>
													<p class="text-xs font-semibold text-muted-foreground uppercase">
														Characters
													</p>
													<p class="mt-1 text-sm leading-6">
														{characterNames(item).join(', ') || 'No character credits'}
													</p>
												</div>
												<div>
													<p class="text-xs font-semibold text-muted-foreground uppercase">
														Credits
													</p>
													<ul class="mt-1 space-y-1 text-sm leading-6">
														{#each groupedCredits(item) as credit (credit)}
															<li>{credit}</li>
														{:else}
															<li>No creator credits</li>
														{/each}
													</ul>
												</div>
											</div>
										</div>
									</li>
								{/if}
							{/each}
						</ul>
					{:else}
						<p class="px-4 py-12 text-center text-sm text-muted-foreground">
							Added ComicVine issues will appear here with publisher, volume, characters, and
							credits.
						</p>
					{/if}
				</section>
			</div>
		{/if}
	</section>
</main>
