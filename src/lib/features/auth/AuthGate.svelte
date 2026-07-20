<script lang="ts">
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as InputOTP from '$lib/components/ui/input-otp/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';

	type Props = {
		code: string;
		codeSent: boolean;
		email: string;
		authError: string | null;
		isSigningIn: boolean;
		onBackToEmail: () => void;
		onSignInAsGuest: () => void;
		onSubmitCode: () => void;
		onSubmitEmail: () => void | Promise<void>;
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
	let isResending = $state(false);
	let isCodeComplete = $derived(code.length === 6);

	function handleEmailSubmit(event: SubmitEvent) {
		event.preventDefault();
		onSubmitEmail();
	}

	function handleCodeSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!isCodeComplete || isSigningIn) return;
		onSubmitCode();
	}

	async function resendCode() {
		if (isSigningIn) return;
		isResending = true;
		try {
			await onSubmitEmail();
		} finally {
			isResending = false;
		}
	}
</script>

<div class="grid min-h-[28rem] place-items-center">
	<section class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
		<header class="flex flex-col gap-2 text-center">
			<h2 class="text-xl font-semibold">
				{codeSent ? 'Check your email' : 'Sign in to Longbox'}
			</h2>
			<p class="text-sm leading-6 text-muted-foreground">
				{#if codeSent}
					We sent a 6-digit sign-in code to
					<span class="font-medium text-foreground">{email}</span>.
				{:else}
					Enter your email to receive a one-time sign-in code.
				{/if}
			</p>
		</header>

		{#if codeSent}
			<form class="mt-6" onsubmit={handleCodeSubmit}>
				<Field.Group>
					<Field.Field data-invalid={Boolean(authError)} class="items-center">
						<InputOTP.Root
							aria-label="Verification code"
							aria-invalid={Boolean(authError)}
							inputId="auth-code"
							bind:value={code}
							class="justify-center"
							disabled={isSigningIn}
							maxlength={6}
							pattern={REGEXP_ONLY_DIGITS}
							required
						>
							{#snippet children({ cells })}
								<InputOTP.Group
									class="gap-2 *:data-[slot=input-otp-slot]:rounded-md *:data-[slot=input-otp-slot]:border"
								>
									{#each cells as cell (cell)}
										<InputOTP.Slot {cell} />
									{/each}
								</InputOTP.Group>
							{/snippet}
						</InputOTP.Root>
					</Field.Field>

					<Button type="submit" size="lg" class="w-full" disabled={!isCodeComplete || isSigningIn}>
						{#if isSigningIn && !isResending}<Spinner data-icon="inline-start" />{/if}
						Verify code
					</Button>

					<Field.Field orientation="horizontal" class="justify-center gap-1">
						<span class="text-sm text-muted-foreground">Didn't receive the code?</span>
						<Button
							type="button"
							variant="link"
							size="xs"
							disabled={isSigningIn}
							onclick={resendCode}
						>
							{#if isResending}<Spinner data-icon="inline-start" />{/if}
							Resend code
						</Button>
					</Field.Field>

					<Button
						type="button"
						variant="ghost"
						class="self-center"
						disabled={isSigningIn}
						onclick={onBackToEmail}
					>
						Use a different email
					</Button>
				</Field.Group>
			</form>
		{:else}
			<form class="mt-6" onsubmit={handleEmailSubmit}>
				<Field.Group>
					<Field.Field data-invalid={Boolean(authError)}>
						<Field.Label for="auth-email">Email</Field.Label>
						<Input
							id="auth-email"
							bind:value={email}
							aria-invalid={Boolean(authError)}
							autocomplete="email"
							disabled={isSigningIn}
							placeholder="you@example.com"
							required
							type="email"
						/>
					</Field.Field>

					<Button type="submit" size="lg" class="w-full" disabled={isSigningIn}>
						{#if isSigningIn}<Spinner data-icon="inline-start" />{/if}
						Continue with email
					</Button>

					<Field.Separator>or</Field.Separator>

					<Button
						type="button"
						variant="outline"
						size="lg"
						class="w-full"
						disabled={isSigningIn}
						onclick={onSignInAsGuest}
					>
						Continue as guest
					</Button>
				</Field.Group>
			</form>
		{/if}

		{#if authError}
			<p class="mt-5 text-center text-sm text-destructive" role="alert">{authError}</p>
		{/if}
	</section>
</div>
