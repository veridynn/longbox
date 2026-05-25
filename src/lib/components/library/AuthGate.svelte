<script lang="ts">
	import { LoaderCircle, Mail, ShieldCheck } from '@lucide/svelte';

	type Props = {
		code: string;
		codeSent: boolean;
		email: string;
		authError: string | null;
		isSigningIn: boolean;
		onBackToEmail: () => void;
		onSignInAsGuest: () => void;
		onSubmitCode: () => void;
		onSubmitEmail: () => void;
	};

	let {
		code = $bindable(),
		codeSent,
		email = $bindable(),
		authError,
		isSigningIn,
		onBackToEmail,
		onSignInAsGuest,
		onSubmitCode,
		onSubmitEmail
	}: Props = $props();

	function handleEmailSubmit(event: SubmitEvent) {
		event.preventDefault();
		onSubmitEmail();
	}

	function handleCodeSubmit(event: SubmitEvent) {
		event.preventDefault();
		onSubmitCode();
	}
</script>

<div class="grid min-h-96 place-items-center">
	<div class="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
		<h2 class="text-xl font-semibold">Open your library</h2>
		<p class="mt-2 text-sm leading-6 text-muted-foreground">
			Sign in with the email you saved, or continue as a guest.
		</p>

		{#if codeSent}
			<form class="mt-5 grid gap-4" onsubmit={handleCodeSubmit}>
				<p class="text-sm leading-6 text-muted-foreground">
					Enter the code sent to <span class="font-medium text-foreground">{email}</span>.
				</p>
				<div class="grid gap-2">
					<label class="text-sm font-medium" for="auth-code">Code</label>
					<div class="relative">
						<ShieldCheck
							class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							id="auth-code"
							bind:value={code}
							class="h-10 w-full rounded-md border border-input bg-input/30 pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={isSigningIn}
							inputmode="numeric"
							placeholder="123456"
							required
						/>
					</div>
				</div>
				<div class="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						class="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
						disabled={isSigningIn}
						onclick={onBackToEmail}
					>
						Change email
					</button>
					<button
						type="submit"
						class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
						disabled={isSigningIn}
					>
						{#if isSigningIn}
							<LoaderCircle class="size-4 animate-spin" />
						{:else}
							<ShieldCheck class="size-4" />
						{/if}
						Sign in
					</button>
				</div>
			</form>
		{:else}
			<form class="mt-5 grid gap-4" onsubmit={handleEmailSubmit}>
				<div class="grid gap-2">
					<label class="text-sm font-medium" for="auth-email">Email</label>
					<div class="relative">
						<Mail
							class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							id="auth-email"
							bind:value={email}
							class="h-10 w-full rounded-md border border-input bg-input/30 pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={isSigningIn}
							placeholder="you@example.com"
							required
							type="email"
						/>
					</div>
				</div>
				<button
					type="submit"
					class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
					disabled={isSigningIn}
				>
					{#if isSigningIn}
						<LoaderCircle class="size-4 animate-spin" />
					{:else}
						<Mail class="size-4" />
					{/if}
					Send sign-in code
				</button>
			</form>
		{/if}

		<div class="my-5 flex items-center gap-3 text-xs text-muted-foreground">
			<div class="h-px flex-1 bg-border"></div>
			<span>or</span>
			<div class="h-px flex-1 bg-border"></div>
		</div>

		<button
			type="button"
			class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
			disabled={isSigningIn}
			onclick={onSignInAsGuest}
		>
			{#if isSigningIn}
				<LoaderCircle class="size-4 animate-spin" />
				Signing in
			{:else}
				Continue as guest
			{/if}
		</button>
		{#if authError}
			<p
				class="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
			>
				{authError}
			</p>
		{/if}
	</div>
</div>
