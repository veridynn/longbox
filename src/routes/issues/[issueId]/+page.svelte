<script lang="ts">
	import {
		BookOpen,
		BookOpenCheck,
		CalendarIcon,
		ArrowLeft,
		CheckCircle2,
		Heart,
		HeartOff,
		LoaderCircle,
		Package,
		PackageCheck,
		Star
	} from '@lucide/svelte';
	import { CalendarDate, DateFormatter, getLocalTimeZone, type DateValue } from '@internationalized/date';
	import { flushSync } from 'svelte';
	import type { PageProps } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Calendar } from '$lib/components/ui/calendar';
	import { Input } from '$lib/components/ui/input';
	import * as Popover from '$lib/components/ui/popover';
	import { Toggle } from '$lib/components/ui/toggle';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import { formatDate } from '$lib/comics/format';
	import type { LibraryIssue } from '$lib/comics/types';
	import {
		getIssueTransitionPreview,
		isActiveIssueTransition,
		issueViewTransitionName,
		primeIssueTransition
	} from '$lib/comics/view-transitions.svelte';
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
	type UserIssueDraft = {
		acquiredAt: string;
		favorite: boolean;
		owned: boolean;
		rating: number | null;
		readStatus: 'read' | 'unread';
		userNote: string;
	};

	let { params }: PageProps = $props();

	const auth = db.useAuth();
	const issueQuery = db.useQuery(() => ({
		issues: {
			$: {
				where: {
					id: params.issueId
				}
			},
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
	}));
	const userIssueQuery = db.useQuery(() =>
		auth.user
			? {
					userIssues: {
						$: {
							where: {
								'owner.id': auth.user.id,
								'issue.id': params.issueId
							}
						}
					}
				}
			: null
	);

	let draft = $state<UserIssueDraft>(emptyDraft());
	let persistedDraft = $state<UserIssueDraft>(emptyDraft());
	let noteEditing = $state(false);
	let acquiredDateOpen = $state(false);
	let saveStatus = $state<SaveStatus>('saved');
	let saveError = $state<string | null>(null);
	let noteInput = $state<HTMLInputElement | null>(null);
	let activeUserIssueId: string | null = null;
	let saveTimeout: ReturnType<typeof window.setTimeout> | null = null;
	let saveRequestId = 0;

	const userIssue = $derived(
		(userIssueQuery.data?.userIssues?.[0] as DetailUserIssue | undefined) ?? null
	);
	const issue = $derived((issueQuery.data?.issues?.[0] as LibraryIssue | undefined) ?? null);
	const transitionPreview = $derived(getIssueTransitionPreview(params.issueId));
	const title = $derived(issue ? issueTitle(issue) : (transitionPreview?.title ?? 'Issue details'));
	const coverImageUrl = $derived(issue?.coverImageUrl ?? transitionPreview?.coverImageUrl ?? null);
	const coverInViewTransition = $derived(
		isActiveIssueTransition(params.issueId) || transitionPreview?.issueId === params.issueId
	);
	const credits = $derived(groupCredits(issue));
	const characters = $derived(characterNames(issue));
	const details = $derived(detailRows(issue));
	const noteStatus = $derived(statusText(saveStatus));
	const acquiredDateValue = $derived(calendarDateFromInput(draft.acquiredAt));
	const ratingValue = $derived(draft.rating ? String(draft.rating) : '');

	const dateFormatter = new DateFormatter('en-US', {
		dateStyle: 'medium'
	});

	$effect(() => {
		if (userIssue?.id === activeUserIssueId) {
			return;
		}

		activeUserIssueId = userIssue?.id ?? null;
		draft = draftFromUserIssue(userIssue);
		persistedDraft = draftFromUserIssue(userIssue);
		noteEditing = false;
		saveStatus = 'saved';
		saveError = null;
		clearPendingSave();
	});

	$effect(() => {
		if (noteEditing) {
			noteInput?.focus();
			noteInput?.select();
		}
	});

	function emptyDraft(): UserIssueDraft {
		return {
			acquiredAt: '',
			favorite: false,
			owned: false,
			rating: null,
			readStatus: 'unread',
			userNote: ''
		};
	}

	function draftFromUserIssue(userIssueValue: DetailUserIssue | null): UserIssueDraft {
		if (!userIssueValue) {
			return emptyDraft();
		}

		return {
			acquiredAt: dateInputValue(userIssueValue.acquiredAt),
			favorite: userIssueValue.favorite,
			owned: userIssueValue.owned,
			rating: userIssueValue.rating ?? null,
			readStatus: userIssueValue.readStatus === 'read' ? 'read' : 'unread',
			userNote: userIssueValue.userNote ?? ''
		};
	}

	function draftSignature(value: UserIssueDraft) {
		return JSON.stringify(value);
	}

	function clearPendingSave() {
		if (!saveTimeout) {
			return;
		}

		window.clearTimeout(saveTimeout);
		saveTimeout = null;
	}

	function updateDraft(patch: Partial<UserIssueDraft>, debounce = false) {
		const nextDraft = { ...draft, ...patch };
		draft = nextDraft;
		queueSave(nextDraft, debounce);
	}

	function queueSave(nextDraft: UserIssueDraft, debounce: boolean) {
		clearPendingSave();

		if (!userIssue) {
			return;
		}

		if (draftSignature(nextDraft) === draftSignature(persistedDraft)) {
			if (saveStatus !== 'saving') {
				saveStatus = 'saved';
				saveError = null;
			}
			return;
		}

		const userIssueId = userIssue.id;
		const requestId = ++saveRequestId;
		saveStatus = 'dirty';
		saveError = null;

		const save = async () => {
			saveTimeout = null;
			saveStatus = 'saving';

			try {
				await db.transact(
					db.tx.userIssues[userIssueId].update({
						acquiredAt: dateFromInput(nextDraft.acquiredAt),
						favorite: nextDraft.favorite,
						owned: nextDraft.owned,
						rating: nextDraft.rating,
						readStatus: nextDraft.readStatus,
						userNote: nextDraft.userNote,
						updatedAt: new Date()
					})
				);

				if (saveRequestId === requestId) {
					persistedDraft = nextDraft;
					saveStatus = 'saved';
				}
			} catch (error) {
				if (saveRequestId === requestId) {
					saveStatus = 'error';
					saveError = error instanceof Error ? error.message : 'Unable to save changes.';
				}
			}
		};

		if (debounce) {
			saveTimeout = window.setTimeout(() => void save(), 700);
			return;
		}

		void save();
	}

	function dateInputValue(date: Date | null | undefined) {
		if (!date) return '';
		const value = date instanceof Date ? date : new Date(date);
		if (Number.isNaN(value.valueOf())) return '';

		const year = value.getUTCFullYear();
		const month = String(value.getUTCMonth() + 1).padStart(2, '0');
		const day = String(value.getUTCDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function dateFromInput(value: string) {
		return value ? new Date(`${value}T00:00:00.000Z`) : null;
	}

	function calendarDateFromInput(value: string): CalendarDate | undefined {
		const [year, month, day] = value.split('-').map(Number);
		if (!year || !month || !day) return undefined;
		return new CalendarDate(year, month, day);
	}

	function inputFromCalendarDate(value: DateValue | undefined) {
		if (!value) return '';
		const month = String(value.month).padStart(2, '0');
		const day = String(value.day).padStart(2, '0');
		return `${value.year}-${month}-${day}`;
	}

	function acquiredDateLabel(value: string) {
		const dateValue = calendarDateFromInput(value);
		if (!dateValue) return 'Select date';
		return dateFormatter.format(dateValue.toDate(getLocalTimeZone()));
	}

	function setAcquiredDate(value: DateValue | undefined) {
		updateDraft({ acquiredAt: inputFromCalendarDate(value) });
		acquiredDateOpen = false;
	}

	function clearAcquiredDate() {
		updateDraft({ acquiredAt: '' });
		acquiredDateOpen = false;
	}

	function setReadChecked(checked: boolean) {
		updateDraft({ readStatus: checked ? 'read' : 'unread' });
	}

	function setOwnedChecked(checked: boolean) {
		updateDraft({ owned: checked });
	}

	function setFavoriteChecked(checked: boolean) {
		updateDraft({ favorite: checked });
	}

	function setRatingValue(value: string) {
		updateDraft({ rating: value ? Number(value) : null });
	}

	function cancelNoteEdit() {
		updateDraft({ userNote: persistedDraft.userNote });
		noteEditing = false;
	}

	function handleNoteKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			noteEditing = false;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			cancelNoteEdit();
		}
	}

	function prepareIssueTransition() {
		if (issue) {
			flushSync(() => primeIssueTransition(issue));
		}
	}

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

	function detailRows(issueValue: LibraryIssue | null) {
		if (!issueValue) {
			return [];
		}

		return [
			['Publisher', issueValue.volume?.publisher?.name ?? 'Unknown publisher'],
			['Volume', issueValue.volume?.name ?? 'Unknown volume'],
			['Issue', `#${issueValue.issueNumber}`],
			['Cover date', formatDate(issueValue.coverDate)],
			['Store date', formatDate(issueValue.storeDate)]
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
			<Button
				href="/"
				variant="ghost"
				class="mb-4 -ml-2"
				onpointerdown={prepareIssueTransition}
				onclick={prepareIssueTransition}
			>
				<ArrowLeft data-icon="inline-start" />
				Library
			</Button>
		</div>

		{#if issueQuery.error}
			<section class="rounded-lg border border-border bg-card p-6">
				<h1 class="text-2xl font-semibold">Unable to load issue</h1>
				<p class="mt-2 text-sm leading-6 text-destructive">{issueQuery.error.message}</p>
			</section>
		{:else if issueQuery.isLoading && !transitionPreview}
			<div class="flex min-h-96 items-center justify-center text-muted-foreground">
				<LoaderCircle class="mr-2 size-4 animate-spin" />
				Loading issue
			</div>
		{:else if !issue && !transitionPreview}
			<section class="rounded-lg border border-border bg-card p-6">
				<h1 class="text-2xl font-semibold">Issue not found</h1>
				<p class="mt-2 text-sm leading-6 text-muted-foreground">
					This issue is not available in the local catalog.
				</p>
			</section>
		{:else}
			<div class="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
				<aside class="space-y-4">
					<img
						class="aspect-[2/3] w-full border border-border object-cover"
						src={coverImageUrl ?? '/robots.txt'}
						alt=""
						style:view-transition-name={coverInViewTransition
							? issueViewTransitionName(params.issueId, 'cover')
							: null}
						style:view-transition-class={coverInViewTransition ? 'issue-cover' : null}
					/>

					{#if !issue}
						<section class="rounded-lg border border-border bg-card p-4">
							<div class="flex items-center text-sm text-muted-foreground">
								<LoaderCircle class="mr-2 size-4 animate-spin" />
								Loading issue
							</div>
						</section>
					{:else if auth.isLoading}
						<section class="rounded-lg border border-border bg-card p-4">
							<div class="flex items-center text-sm text-muted-foreground">
								<LoaderCircle class="mr-2 size-4 animate-spin" />
								Loading library fields
							</div>
						</section>
					{:else if auth.user}
						<section class="rounded-lg border border-border bg-card p-4">
							<div class="flex flex-wrap items-center justify-between gap-3">
								<h2 class="font-semibold">My library</h2>
								<div class="flex items-center gap-2 text-sm text-muted-foreground">
									{#if saveStatus === 'saving'}
										<LoaderCircle class="size-4 animate-spin" />
									{:else if saveStatus === 'saved'}
										<CheckCircle2 class="size-4 text-emerald-600" />
									{/if}
									<span class:text-destructive={saveStatus === 'error'}>{noteStatus}</span>
								</div>
							</div>

							{#if userIssueQuery.isLoading}
								<div class="mt-4 flex items-center text-sm text-muted-foreground">
									<LoaderCircle class="mr-2 size-4 animate-spin" />
									Loading saved issue
								</div>
							{:else if userIssueQuery.error}
								<p class="mt-3 text-sm text-destructive">{userIssueQuery.error.message}</p>
							{:else if userIssue}
								<div class="mt-3 space-y-3">
									<div class="grid grid-cols-3 gap-2">
										<Toggle
											pressed={draft.readStatus === 'read'}
											variant="outline"
											class="w-full justify-center gap-1 px-2 text-xs data-[state=on]:bg-muted"
											aria-label={draft.readStatus === 'read' ? 'Mark as unread' : 'Mark as read'}
											onPressedChange={setReadChecked}
										>
											{#if draft.readStatus === 'read'}
												<BookOpenCheck data-icon="inline-start" />
											{:else}
												<BookOpen data-icon="inline-start" />
											{/if}
											Read
										</Toggle>

										<Toggle
											pressed={draft.owned}
											variant="outline"
											class="w-full justify-center gap-1 px-2 text-xs data-[state=on]:bg-muted"
											aria-label={draft.owned ? 'Mark as not owned' : 'Mark as owned'}
											onPressedChange={setOwnedChecked}
										>
											{#if draft.owned}
												<PackageCheck data-icon="inline-start" />
											{:else}
												<Package data-icon="inline-start" />
											{/if}
											Owned
										</Toggle>

										<Toggle
											pressed={draft.favorite}
											variant="outline"
											class="w-full justify-center gap-1 px-2 text-xs data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:*:[svg]:fill-current"
											aria-label={draft.favorite ? 'Remove favorite' : 'Mark as favorite'}
											onPressedChange={setFavoriteChecked}
										>
											{#if draft.favorite}
												<Heart data-icon="inline-start" />
											{:else}
												<HeartOff data-icon="inline-start" />
											{/if}
											Favorite
										</Toggle>
									</div>

									<div>
										<p class="text-xs font-semibold text-muted-foreground uppercase">Rating</p>
										<div class="mt-2 flex flex-wrap items-center gap-2">
											<ToggleGroup.Root
												type="single"
												value={ratingValue}
												onValueChange={setRatingValue}
												size="sm"
												spacing={1}
												aria-label="Issue rating"
											>
											{#each [1, 2, 3, 4, 5] as rating (rating)}
													<ToggleGroup.Item
														value={String(rating)}
														class="text-muted-foreground data-[state=on]:bg-transparent data-[state=on]:text-amber-500 data-[state=on]:*:[svg]:fill-amber-400 data-[state=on]:*:[svg]:stroke-amber-500"
													aria-label={draft.rating === rating
														? `Clear ${rating} star rating`
														: `Set rating to ${rating} ${rating === 1 ? 'star' : 'stars'}`}
												>
													<Star
														class={`size-5 ${
															draft.rating && rating <= draft.rating
																? 'fill-amber-400 text-amber-500'
																: ''
														}`}
													/>
													</ToggleGroup.Item>
											{/each}
											</ToggleGroup.Root>
											<span class="ml-1 text-sm text-muted-foreground">
												{draft.rating ? `${draft.rating}/5` : 'Unrated'}
											</span>
										</div>
									</div>

									<div>
										<p class="text-xs font-semibold text-muted-foreground uppercase">Acquired</p>
										<Popover.Root bind:open={acquiredDateOpen}>
											<Popover.Trigger>
												{#snippet child({ props })}
													<Button
														{...props}
														variant="outline"
														class="mt-2 w-full justify-start text-left font-normal"
													>
														<CalendarIcon data-icon="inline-start" />
														<span class:text-muted-foreground={!draft.acquiredAt}>
															{acquiredDateLabel(draft.acquiredAt)}
														</span>
													</Button>
												{/snippet}
											</Popover.Trigger>
											<Popover.Content class="w-auto p-0" align="start">
												<Calendar
													type="single"
													value={acquiredDateValue}
													onValueChange={setAcquiredDate}
													captionLayout="dropdown"
													initialFocus
												/>
												{#if draft.acquiredAt}
													<div class="border-t border-border p-2">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															class="w-full"
															onclick={clearAcquiredDate}
														>
															Clear date
														</Button>
													</div>
												{/if}
											</Popover.Content>
										</Popover.Root>
									</div>

									<div>
										<p class="text-xs font-semibold text-muted-foreground uppercase">Notes</p>
										{#if noteEditing}
											<label class="sr-only" for="issue-note">Issue note</label>
											<Input
												id="issue-note"
												bind:ref={noteInput}
												class="mt-2"
												value={draft.userNote}
												oninput={(event) =>
													updateDraft({ userNote: event.currentTarget.value }, true)}
												onblur={() => (noteEditing = false)}
												onkeydown={handleNoteKeydown}
											/>
										{:else}
											<button
												type="button"
												class="mt-2 block min-h-8 w-full rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted"
												onclick={() => (noteEditing = true)}
											>
												{#if draft.userNote}
													<span class="line-clamp-1">{draft.userNote}</span>
												{:else}
													<span class="text-muted-foreground">Add a note</span>
												{/if}
											</button>
										{/if}
									</div>
								</div>

								{#if saveError}
									<p class="mt-3 text-sm text-destructive">{saveError}</p>
								{/if}
							{:else}
								<p class="mt-3 text-sm leading-6 text-muted-foreground">
									This issue is not saved in your library.
								</p>
							{/if}
						</section>
					{/if}
				</aside>

				<div class="min-w-0 space-y-6">
					<header>
						<p class="text-sm font-medium text-muted-foreground">
							{issue?.volume?.publisher?.name ?? 'Unknown publisher'}
						</p>
						<h1 class="mt-2 text-3xl font-semibold tracking-normal text-balance">
							{title}
						</h1>
						<p class="mt-2 text-sm text-muted-foreground">
							{#if issue}
								{formatDate(issue.coverDate)} · {issue.volume?.name ?? 'Unknown volume'}
							{:else}
								Loading issue
							{/if}
						</p>
					</header>

					{#if issue}
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
					{/if}
				</div>
			</div>
		{/if}
	</section>
</main>
