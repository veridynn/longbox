<script lang="ts">
	import { LoaderCircle, Mail, ShieldCheck } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	type Step = 'email' | 'code';

	type Props = {
		code: string;
		codeSent: boolean;
		email: string;
		errorMessage: string | null;
		isSubmitting: boolean;
		onBackToEmail: () => void;
		onSubmitCode: () => void;
		onSubmitEmail: () => void;
		open: boolean;
	};

	let {
		code = $bindable(),
		codeSent,
		email = $bindable(),
		errorMessage,
		isSubmitting,
		onBackToEmail,
		onSubmitCode,
		onSubmitEmail,
		open = $bindable()
	}: Props = $props();

	let step = $derived((codeSent ? 'code' : 'email') as Step);

	function handleEmailSubmit(event: SubmitEvent) {
		event.preventDefault();
		onSubmitEmail();
	}

	function handleCodeSubmit(event: SubmitEvent) {
		event.preventDefault();
		onSubmitCode();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Save your collection</Dialog.Title>
			<Dialog.Description>
				Register this guest account with an email so you can sign in again later.
			</Dialog.Description>
		</Dialog.Header>

		{#if step === 'email'}
			<form class="grid gap-4" onsubmit={handleEmailSubmit}>
				<div class="grid gap-2">
					<label class="text-sm font-medium" for="save-account-email">Email</label>
					<div class="relative">
						<Mail
							class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							id="save-account-email"
							bind:value={email}
							class="h-10 w-full rounded-md border border-input bg-input/30 pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={isSubmitting}
							placeholder="you@example.com"
							required
							type="email"
						/>
					</div>
				</div>

				{#if errorMessage}
					<p
						class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					>
						{errorMessage}
					</p>
				{/if}

				<div class="flex justify-end gap-2">
					<button
						type="submit"
						class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<LoaderCircle class="size-4 animate-spin" />
						{:else}
							<Mail class="size-4" />
						{/if}
						Send code
					</button>
				</div>
			</form>
		{:else}
			<form class="grid gap-4" onsubmit={handleCodeSubmit}>
				<p class="text-sm leading-6 text-muted-foreground">
					Enter the code sent to <span class="font-medium text-foreground">{email}</span>.
				</p>

				<div class="grid gap-2">
					<label class="text-sm font-medium" for="save-account-code">Code</label>
					<div class="relative">
						<ShieldCheck
							class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
						/>
						<input
							id="save-account-code"
							bind:value={code}
							class="h-10 w-full rounded-md border border-input bg-input/30 pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={isSubmitting}
							inputmode="numeric"
							placeholder="123456"
							required
						/>
					</div>
				</div>

				{#if errorMessage}
					<p
						class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					>
						{errorMessage}
					</p>
				{/if}

				<div class="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						class="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
						disabled={isSubmitting}
						onclick={onBackToEmail}
					>
						Change email
					</button>
					<button
						type="submit"
						class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
						disabled={isSubmitting}
					>
						{#if isSubmitting}
							<LoaderCircle class="size-4 animate-spin" />
						{:else}
							<ShieldCheck class="size-4" />
						{/if}
						Save account
					</button>
				</div>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
