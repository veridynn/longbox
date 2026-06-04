<script lang="ts">
	import { ArrowLeft, CheckCircle2, LoaderCircle } from '@lucide/svelte';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { formatDate } from '$lib/comics/format';
	import type { LibraryIssue } from '$lib/comics/types';
	import { db } from '$lib/db';

	type DetailUserIssue = {
		id: string;
		acquiredAt?: Date | null;
		favorite: boolean;
		owned: boolean;
		rating?: number | null;
		readStatus: string;
		updatedAt: Date;
		userNote?: string | null;
		issue?: LibraryIssue | null;
	};

	type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';

	let { params }: PageProps = $props();

	const auth = db.useAuth();
	const userIssueQuery = db.useQuery(() =>
		auth.user
			? {
					userIssues: {
						$: {
							where: {
								'owner.id': auth.user.id,
								'issue.id': params.issueId
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

	let note = $state('');
	let persistedNote = $state('');
	let saveStatus = $state<SaveStatus>('saved');
	let saveError = $state<string | null>(null);
	let activeUserIssueId: string | null = null;
	let saveRequestId = 0;

	const userIssue = $derived(
		(userIssueQuery.data?.userIssues?.[0] as DetailUserIssue | undefined) ?? null
	);
	const issue = $derived(userIssue?.issue ?? null);
	const title = $derived(issue ? issueTitle(issue) : 'Issue details');
	const credits = $derived(groupCredits(issue));
	const characters = $derived(characterNames(issue));
	const details = $derived(detailRows(userIssue, issue));
	const noteStatus = $derived(statusText(saveStatus));

	$effect(() => {
		if (userIssue?.id === activeUserIssueId) {
			return;
		}

		activeUserIssueId = userIssue?.id ?? null;
		note = userIssue?.userNote ?? '';
		persistedNote = userIssue?.userNote ?? '';
		saveStatus = 'saved';
		saveError = null;
	});

	$effect(() => {
		if (!userIssue || note === persistedNote) {
			if (saveStatus !== 'saving') {
				saveStatus = 'saved';
				saveError = null;
			}
			return;
		}

		const userIssueId = userIssue.id;
		const nextNote = note;
		const requestId = ++saveRequestId;
		saveStatus = 'dirty';
		saveError = null;

		const timeout = window.setTimeout(async () => {
			saveStatus = 'saving';

			try {
				await db.transact(
					db.tx.userIssues[userIssueId].update({
						userNote: nextNote,
						updatedAt: new Date()
					})
				);

				if (saveRequestId === requestId) {
					persistedNote = nextNote;
					saveStatus = 'saved';
				}
			} catch (error) {
				if (saveRequestId === requestId) {
					saveStatus = 'error';
					saveError = error instanceof Error ? error.message : 'Unable to save note.';
				}
			}
		}, 700);

		return () => window.clearTimeout(timeout);
	});

	function issueTitle(issueValue: LibraryIssue) {
		const volumeName = issueValue.volume?.name ?? 'Unknown volume';
		const issueName = issueValue.name ? `: ${issueValue.name}` : '';
		return `${volumeName} #${issueValue.issueNumber}${issueName}`;
	}

	function linkedName(value: { name: string } | Array<{ name: string }> | null | undefined) {
		const record = Array.isArray(value) ? value[0] : value;
		return record?.name;
	}

	function characterNames(issueValue: LibraryIssue | null) {
		return Array.from(
			new Set(
				(issueValue?.issueCharacters ?? [])
					.map((appearance) => linkedName(appearance.character))
					.filter((name): name is string => Boolean(name))
			)
		);
	}

	function groupCredits(issueValue: LibraryIssue | null) {
		const byRole: Record<string, string[]> = {};

		for (const credit of issueValue?.credits ?? []) {
			const personName = linkedName(credit.person);
			if (!personName) continue;

			byRole[credit.role] = [...(byRole[credit.role] ?? []), personName];
		}

		return Object.entries(byRole).map(([role, names]) => ({
			role,
			names: Array.from(new Set(names)).join(', ')
		}));
	}

	function detailRows(userIssueValue: DetailUserIssue | null, issueValue: LibraryIssue | null) {
		if (!userIssueValue || !issueValue) {
			return [];
		}

		return [
			['Publisher', issueValue.volume?.publisher?.name ?? 'Unknown publisher'],
			['Volume', issueValue.volume?.name ?? 'Unknown volume'],
			['Issue', `#${issueValue.issueNumber}`],
			['Cover date', formatDate(issueValue.coverDate)],
			['Store date', formatDate(issueValue.storeDate)],
			['Read status', userIssueValue.readStatus],
			['Owned', userIssueValue.owned ? 'Yes' : 'No'],
			['Favorite', userIssueValue.favorite ? 'Yes' : 'No'],
			['Rating', userIssueValue.rating ? `${userIssueValue.rating}/5` : 'Not rated'],
			['Acquired', formatDate(userIssueValue.acquiredAt)]
		];
	}

	function statusText(status: SaveStatus) {
		if (status === 'saving') return 'Saving...';
		if (status === 'dirty') return 'Unsaved changes';
		if (status === 'error') return 'Unable to save';
		return 'Saved';
	}
</script>

<svelte:head>
	<title>{title} | Longbox</title>
</svelte:head>

<main class="min-h-screen bg-background text-foreground">
	<section class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
		<div>
			<Button href="/" variant="ghost" class="mb-4 -ml-2">
				<ArrowLeft data-icon="inline-start" />
				Library
			</Button>
		</div>

		{#if auth.isLoading}
			<div class="flex min-h-96 items-center justify-center text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading issue
			</div>
		{:else if !auth.user}
			<section class="rounded-lg border border-border bg-card p-6">
				<h1 class="text-2xl font-semibold">Sign in to view this issue</h1>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					Issue details and notes are available for saved library items.
				</p>
				<Button href="/" class="mt-5">Go to sign in</Button>
			</section>
		{:else if userIssueQuery.isLoading}
			<div class="flex min-h-96 items-center justify-center text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading issue
			</div>
		{:else if userIssueQuery.error}
			<section class="rounded-lg border border-border bg-card p-6">
				<h1 class="text-2xl font-semibold">Unable to load issue</h1>
				<p class="mt-2 text-sm leading-6 text-destructive">{userIssueQuery.error.message}</p>
			</section>
		{:else if !userIssue || !issue}
			<section class="rounded-lg border border-border bg-card p-6">
				<h1 class="text-2xl font-semibold">Issue not found</h1>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					This issue is not saved in your library, or you do not have access to it.
				</p>
			</section>
		{:else}
			<div class="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
				<aside>
					<img
						class="aspect-[2/3] w-full rounded-lg border border-border object-cover"
						src={issue.coverImageUrl ?? '/robots.txt'}
						alt=""
					/>
				</aside>

				<div class="min-w-0 space-y-6">
					<header>
						<p class="text-sm font-medium text-muted-foreground">
							{issue.volume?.publisher?.name ?? 'Unknown publisher'}
						</p>
						<h1 class="mt-2 text-3xl font-semibold tracking-normal text-balance">{title}</h1>
						<p class="mt-2 text-sm text-muted-foreground">
							{formatDate(issue.coverDate)} · {issue.volume?.name ?? 'Unknown volume'}
						</p>
					</header>

					<section class="rounded-lg border border-border bg-card p-4">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<h2 class="font-semibold">Notes</h2>
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								{#if saveStatus === 'saving'}
									<LoaderCircle class="size-4 animate-spin" />
								{:else if saveStatus === 'saved'}
									<CheckCircle2 class="size-4 text-emerald-600" />
								{/if}
								<span class:text-destructive={saveStatus === 'error'}>{noteStatus}</span>
							</div>
						</div>

						<label class="sr-only" for="issue-note">Issue note</label>
						<Textarea
							id="issue-note"
							class="mt-3 min-h-36 resize-y"
							placeholder="Add your thoughts, condition notes, or reading context."
							bind:value={note}
						/>

						{#if saveError}
							<p class="mt-2 text-sm text-destructive">{saveError}</p>
						{/if}
					</section>

					<section class="rounded-lg border border-border bg-card p-4">
						<h2 class="font-semibold">Details</h2>
						<dl class="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
							{#each details as [label, value] (label)}
								<div>
									<dt class="text-xs font-semibold text-muted-foreground uppercase">{label}</dt>
									<dd class="mt-1 text-sm">{value}</dd>
								</div>
							{/each}
						</dl>
					</section>

					{#if issue.summary || issue.descriptionHtml}
						<section class="rounded-lg border border-border bg-card p-4">
							<h2 class="font-semibold">Description</h2>
							{#if issue.summary}
								<p class="mt-3 text-sm leading-6 text-muted-foreground">{issue.summary}</p>
							{/if}
							{#if issue.descriptionHtml}
								<div class="prose prose-sm mt-4 max-w-none text-foreground">
									{@html issue.descriptionHtml}
								</div>
							{/if}
						</section>
					{/if}

					<section class="grid gap-6 md:grid-cols-2">
						<div class="rounded-lg border border-border bg-card p-4">
							<h2 class="font-semibold">Characters</h2>
							<p class="mt-3 text-sm leading-6">
								{characters.join(', ') || 'No character credits'}
							</p>
						</div>

						<div class="rounded-lg border border-border bg-card p-4">
							<h2 class="font-semibold">Credits</h2>
							<ul class="mt-3 space-y-2 text-sm leading-6">
								{#each credits as credit (credit.role)}
									<li><span class="font-medium">{credit.role}:</span> {credit.names}</li>
								{:else}
									<li>No creator credits</li>
								{/each}
							</ul>
						</div>
					</section>
				</div>
			</div>
		{/if}
	</section>
</main>
