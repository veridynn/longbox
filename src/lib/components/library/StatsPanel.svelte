<script lang="ts">
	import { BookOpen, CheckCircle2, Eye, Heart, List } from '@lucide/svelte';

	type Props = {
		favoriteCount: number;
		issueCount: number;
		listCount: number;
		readCount: number;
		watchlistCount: number;
	};

	let { favoriteCount, issueCount, listCount, readCount, watchlistCount }: Props = $props();
</script>

<section aria-labelledby="overview-heading" class="grid gap-3">
	<div class="flex items-center justify-between">
		<h2 id="overview-heading" class="font-semibold">Overview</h2>
	</div>

	<div class="grid grid-cols-2 gap-3 md:grid-cols-5">
		<article class="rounded-lg border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<BookOpen class="size-4" />
				Library
			</div>
			<p class="mt-3 text-2xl font-semibold">{issueCount}</p>
		</article>

		<article class="rounded-lg border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Heart class="size-4 text-rose-500" />
				Favorites
			</div>
			<p class="mt-3 text-2xl font-semibold">{favoriteCount}</p>
		</article>

		<article class="rounded-lg border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Eye class="size-4 text-sky-500" />
				Watchlist
			</div>
			<p class="mt-3 text-2xl font-semibold">{watchlistCount}</p>
		</article>

		<article class="rounded-lg border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<CheckCircle2 class="size-4 text-emerald-500" />
				Read
			</div>
			<p class="mt-3 text-2xl font-semibold">{readCount}</p>
		</article>

		<article class="rounded-lg border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<List class="size-4" />
				Lists
			</div>
			<p class="mt-3 text-2xl font-semibold">{listCount}</p>
		</article>
	</div>
</section>
