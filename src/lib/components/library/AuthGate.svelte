<script lang="ts">
	import { LoaderCircle } from '@lucide/svelte';

	type Props = {
		authError: string | null;
		isSigningIn: boolean;
		onSignIn: () => void;
	};

	let { authError, isSigningIn, onSignIn }: Props = $props();
</script>

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
			onclick={onSignIn}
		>
			{#if isSigningIn}
				<LoaderCircle class="size-4 animate-spin" />
				Signing in
			{:else}
				Continue as guest
			{/if}
		</button>
		{#if authError}
			<p class="mt-3 text-sm text-destructive">{authError}</p>
		{/if}
	</div>
</div>
