<script lang="ts">
	import {
		CircleAlert,
		ListPlus,
		Search,
		SearchX
	} from '@lucide/svelte';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';
	import IssueListPanel from '$lib/features/issues/IssueListPanel.svelte';
	import { IssueSort } from '$lib/features/issues/sort';
	import ListsPanel from '$lib/features/main-page/ListsPanel.svelte';
	import CollectionPanel from '$lib/features/main-page/CollectionPanel.svelte';
	import ComicSearchPanel from '$lib/features/search/ComicSearchPanel.svelte';
	import { ComicSearchState } from '$lib/features/search/comic-search-state.svelte';

	const initialSearch = new ComicSearchState();
	const noResultsSearch = new ComicSearchState();
	noResultsSearch.tags = [{ type: 'volume', value: 'Batman', label: 'Batman' }];
	noResultsSearch.hasSearched = true;
	const failedSearch = new ComicSearchState();
	failedSearch.tags = [{ type: 'volume', value: 'Batman', label: 'Batman' }];
	failedSearch.hasSearched = true;
	failedSearch.error = 'Unable to search. Try again.';

	let initialSearchOpen = $state(false);
	let noResultsSearchOpen = $state(false);
	let failedSearchOpen = $state(false);

	const noop = () => {};
	const isInCollection = () => false;
</script>

<svelte:head>
	<title>E2E state fixtures | Longbox</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-7xl flex-col gap-12 px-5 py-8 sm:px-8 lg:px-10">
	<header class="flex flex-col gap-2">
		<p class="text-sm font-medium text-muted-foreground">Playwright fixtures</p>
		<h1 class="text-3xl font-semibold">Error and empty states</h1>
	</header>

	<section class="flex flex-col gap-6" aria-labelledby="empty-states-heading">
		<div>
			<p class="text-sm text-muted-foreground">Collection and list panels</p>
			<h2 id="empty-states-heading" class="text-xl font-semibold">Empty states</h2>
		</div>

		<div class="rounded-xl border p-4">
			<CollectionPanel
				errorMessage={null}
				isLoading={false}
				items={[]}
				onAddIssue={noop}
				onSortKeyChange={noop}
				onViewModeChange={noop}
				sortKey={IssueSort.NewestAdded}
				viewMode="gallery"
			/>
		</div>

		<div class="rounded-xl border p-4">
			<ListsPanel customLists={[]} onCreateList={noop} onRenameList={noop} />
		</div>

		<div class="rounded-xl border">
			<IssueListPanel
				items={[]}
				onSortKeyChange={noop}
				onViewModeChange={noop}
				sortKey={IssueSort.Custom}
				viewMode="gallery"
			>
				{#snippet empty()}
					<Empty.Root class="py-12">
						<Empty.Header>
							<Empty.Media variant="icon">
								<ListPlus aria-hidden="true" />
							</Empty.Media>
							<Empty.Title>
								<h3>This list is empty</h3>
							</Empty.Title>
							<Empty.Description>
								Add issues from your Collection, or search for something new.
							</Empty.Description>
						</Empty.Header>
						<Empty.Content>
							<Button>
								<ListPlus data-icon="inline-start" />
								Add issues
							</Button>
						</Empty.Content>
					</Empty.Root>
				{/snippet}
			</IssueListPanel>
		</div>
	</section>

	<section class="flex flex-col gap-4" aria-labelledby="alerts-heading">
		<div>
			<p class="text-sm text-muted-foreground">Panel failures</p>
			<h2 id="alerts-heading" class="text-xl font-semibold">Error alerts</h2>
		</div>
		<div class="rounded-xl border p-4">
			<ListsPanel
				customLists={[]}
				errorMessage="Unable to load lists."
				onCreateList={noop}
				onRenameList={noop}
			/>
		</div>
		<div class="rounded-xl border">
			<IssueListPanel
				errorMessage="Unable to load issues."
				items={[]}
				onSortKeyChange={noop}
				onViewModeChange={noop}
				sortKey={IssueSort.Custom}
				viewMode="gallery"
			/>
		</div>
		<div class="grid gap-4 lg:grid-cols-2">
			<Alert.Root variant="destructive">
				<CircleAlert aria-hidden="true" />
				<Alert.Title>Couldn’t update this list</Alert.Title>
				<Alert.Description>Unable to remove this issue.</Alert.Description>
			</Alert.Root>
			<Alert.Root variant="destructive">
				<CircleAlert aria-hidden="true" />
				<Alert.Title>Couldn’t save changes</Alert.Title>
				<Alert.Description>Unable to save changes.</Alert.Description>
			</Alert.Root>
		</div>
	</section>

	<section class="flex flex-col gap-4" aria-labelledby="search-states-heading">
		<div>
			<p class="text-sm text-muted-foreground">Comic search dialog</p>
			<h2 id="search-states-heading" class="text-xl font-semibold">Search states</h2>
		</div>
		<div class="flex flex-wrap gap-3">
			<Button onclick={() => (initialSearchOpen = true)}>
				<Search data-icon="inline-start" />
				Open initial state
			</Button>
			<Button variant="outline" onclick={() => (noResultsSearchOpen = true)}>
				<SearchX data-icon="inline-start" />
				Open no-results state
			</Button>
			<Button variant="outline" onclick={() => (failedSearchOpen = true)}>
				<CircleAlert data-icon="inline-start" />
				Open error state
			</Button>
		</div>
	</section>
</main>

<ComicSearchPanel
	addError={null}
	addingIssueIds={[]}
	isInCollection={isInCollection}
	onAddIssue={noop}
	bind:open={initialSearchOpen}
	search={initialSearch}
/>
<ComicSearchPanel
	addError={null}
	addingIssueIds={[]}
	isInCollection={isInCollection}
	onAddIssue={noop}
	bind:open={noResultsSearchOpen}
	search={noResultsSearch}
/>
<ComicSearchPanel
	addError={null}
	addingIssueIds={[]}
	isInCollection={isInCollection}
	onAddIssue={noop}
	bind:open={failedSearchOpen}
	search={failedSearch}
/>
