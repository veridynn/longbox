<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import * as InputOTP from '$lib/components/ui/input-otp/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';

	type Props = {
		code: string;
		email: string;
		errorMessage: string | null;
		isSubmitting: boolean;
		onBackToEmail: () => void;
		onResendCode: () => void | Promise<void>;
		onSubmitCode: () => void;
		onSubmitProfile: () => void;
		open: boolean;
		profilePending: boolean;
	};

	let {
		code = $bindable(),
		email,
		errorMessage,
		isSubmitting,
		onBackToEmail,
		onResendCode,
		onSubmitCode,
		onSubmitProfile,
		open = $bindable(),
		profilePending
	}: Props = $props();
	let isResending = $state(false);
	let isBusy = $derived(isSubmitting || isResending);
	let isCodeComplete = $derived(code.length === 6);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (isBusy || (!profilePending && !isCodeComplete)) return;
		if (profilePending) onSubmitProfile();
		else onSubmitCode();
	}

	async function resendCode() {
		if (isBusy) return;
		isResending = true;
		try {
			await onResendCode();
		} finally {
			isResending = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>{profilePending ? 'Finish setup' : 'Check your email'}</Dialog.Title>
			<Dialog.Description>
				{#if profilePending}
					Your email is verified. Finish saving your profile to complete setup.
				{:else}
					We sent a 6-digit confirmation code to
					<span class="font-medium text-foreground">{email}</span>.
				{/if}
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={submit}>
			<Field.Group>
				{#if !profilePending}
					<Field.Field data-invalid={Boolean(errorMessage)} class="items-center">
						<InputOTP.Root
							aria-label="Verification code"
							aria-invalid={Boolean(errorMessage)}
							inputId="save-account-confirmation-code"
							bind:value={code}
							class="justify-center"
							disabled={isBusy}
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
				{/if}

				{#if errorMessage}
					<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
				{/if}

				<Button
					type="submit"
					size="lg"
					class="w-full"
					disabled={isBusy || (!profilePending && !isCodeComplete)}
				>
					{#if isSubmitting && !isResending}<Spinner data-icon="inline-start" />{/if}
					{profilePending ? 'Finish setup' : 'Verify code'}
				</Button>

				{#if !profilePending}
					<Field.Field orientation="horizontal" class="justify-center gap-1">
						<span class="text-sm text-muted-foreground">Didn't receive the code?</span>
						<Button
							type="button"
							variant="link"
							size="xs"
							disabled={isBusy}
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
						disabled={isBusy}
						onclick={onBackToEmail}
					>
						Use a different email
					</Button>
				{/if}
			</Field.Group>
		</form>
	</Dialog.Content>
</Dialog.Root>
