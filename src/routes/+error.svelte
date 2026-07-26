<script lang="ts">
	import { CircleAlert, FileQuestion, House, RefreshCcw } from '@lucide/svelte';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import * as Empty from '$lib/components/ui/empty';

	const state = $derived.by(() => {
		if (page.status === 400) {
			return {
				description: 'The request was not valid. Return to your collection and try again.',
				title: 'We couldn’t open this page'
			};
		}

		if (page.status === 404) {
			return {
				description: 'The page may have moved, been deleted, or never existed.',
				title: 'Page not found'
			};
		}

		if (page.status >= 500) {
			return {
				description: 'Longbox couldn’t load this page. Try again in a moment.',
				title: 'Something went wrong'
			};
		}

		return {
			description: 'Return to your collection and try another page.',
			title: 'This page isn’t available'
		};
	});

	const canRetry = $derived(page.status >= 500);
</script>

<svelte:head>
	<title>{page.status}: {state.title} | Longbox</title>
</svelte:head>

<main class="mx-auto flex w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
	<Empty.Root
		class="relative min-h-[68vh] overflow-hidden border bg-gradient-to-b from-muted/50 from-30% to-background p-6 sm:p-10"
		aria-labelledby="error-page-title"
	>
		<div
			class="absolute -top-24 -right-24 size-72 rounded-full bg-primary/5 blur-3xl"
			aria-hidden="true"
		></div>
		<div
			class="absolute -bottom-32 -left-20 size-80 rounded-full bg-muted blur-3xl"
			aria-hidden="true"
		></div>

		<div
			class="relative grid w-full max-w-5xl items-center gap-8 text-left lg:grid-cols-[1fr_1.15fr] lg:gap-16"
		>
			<p
				class="text-center text-[clamp(7rem,22vw,15rem)] leading-none font-black tracking-tighter text-foreground/8 select-none lg:text-left"
				aria-hidden="true"
			>
				{page.status}
			</p>

			<div class="flex flex-col items-center gap-7 text-center lg:items-start lg:text-left">
				<Empty.Header class="max-w-lg items-center gap-3 lg:items-start">
					<Empty.Media variant="icon">
						{#if page.status === 404}
							<FileQuestion aria-hidden="true" />
						{:else}
							<CircleAlert aria-hidden="true" />
						{/if}
					</Empty.Media>
					<p class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
						Error {page.status}
					</p>
					<Empty.Title>
						<h1 id="error-page-title" class="text-3xl font-semibold tracking-tight sm:text-4xl">
							{state.title}
						</h1>
					</Empty.Title>
					<Empty.Description class="max-w-md text-base">{state.description}</Empty.Description>
				</Empty.Header>
				<Empty.Content class="sm:flex-row lg:items-start">
					{#if canRetry}
						<Button onclick={() => window.location.reload()}>
							<RefreshCcw data-icon="inline-start" />
							Try again
						</Button>
					{/if}
					<Button href="/" variant={canRetry ? 'outline' : 'default'}>
						<House data-icon="inline-start" />
						Collection
					</Button>
				</Empty.Content>
			</div>
		</div>
	</Empty.Root>
</main>
