<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import ProfileImageField from '$lib/features/main-page/ProfileImageField.svelte';

	type EmailAvailability = 'idle' | 'checking' | 'available' | 'unavailable';
	type Step = 'email' | 'code' | 'profile';

	type Props = {
		code: string;
		codeSent: boolean;
		email: string;
		emailAvailability: EmailAvailability;
		errorMessage: string | null;
		imageFile: File | null;
		isSubmitting: boolean;
		name: string;
		onBackToEmail: () => void;
		onEmailBlur: () => void;
		onEmailChange: () => void;
		onSubmitCode: () => void;
		onSubmitEmail: () => void;
		onSubmitProfile: () => void;
		open: boolean;
		profileImageSrc: string;
		profilePending: boolean;
		removeImage: boolean;
	};

	let {
		code = $bindable(),
		codeSent,
		email = $bindable(),
		emailAvailability,
		errorMessage,
		imageFile = $bindable(),
		isSubmitting,
		name = $bindable(),
		onBackToEmail,
		onEmailBlur,
		onEmailChange,
		onSubmitCode,
		onSubmitEmail,
		onSubmitProfile,
		open = $bindable(),
		profileImageSrc = $bindable(),
		profilePending,
		removeImage = $bindable()
	}: Props = $props();

	let step = $derived((profilePending ? 'profile' : codeSent ? 'code' : 'email') as Step);
	let missingName = $derived(!name.trim());

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (missingName || isSubmitting) return;

		if (step === 'email') onSubmitEmail();
		else if (step === 'code') onSubmitCode();
		else onSubmitProfile();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Save account</Dialog.Title>
			<Dialog.Description>
				Add your profile and email so you can sign in again later.
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={submit}>
			<Field.Group>
				<ProfileImageField
					bind:imageFile
					bind:profileImageSrc
					bind:removeImage
					disabled={isSubmitting}
					inputId="save-account-image"
					{open}
				/>

				<Field.Field>
					<Field.Label for="save-account-name">Display name</Field.Label>
					<Input
						id="save-account-name"
						bind:value={name}
						autocomplete="name"
						disabled={isSubmitting}
						maxlength={80}
						required
					/>
				</Field.Field>

				{#if step === 'email'}
					<Field.Field data-invalid={emailAvailability === 'unavailable'}>
						<Field.Label for="save-account-email">Email</Field.Label>
						<Input
							id="save-account-email"
							bind:value={email}
							autocomplete="email"
							disabled={isSubmitting}
							placeholder="you@example.com"
							required
							type="email"
							onblur={onEmailBlur}
							oninput={onEmailChange}
						/>
						{#if emailAvailability === 'checking'}
							<Field.Description>Checking email availability…</Field.Description>
						{:else if emailAvailability === 'available'}
							<Field.Description>This email is available.</Field.Description>
						{:else if emailAvailability === 'unavailable'}
							<Field.Error>This email is already registered.</Field.Error>
						{/if}
					</Field.Field>
				{:else if step === 'code'}
					<Field.Field>
						<Field.Label for="save-account-code">Verification code</Field.Label>
						<Field.Description>
							Enter the code sent to <span class="font-medium text-foreground">{email}</span>.
						</Field.Description>
						<Input
							id="save-account-code"
							bind:value={code}
							autocomplete="one-time-code"
							disabled={isSubmitting}
							inputmode="numeric"
							placeholder="123456"
							required
						/>
					</Field.Field>
				{:else}
					<Field.Description>
						Your email is verified. Finish saving your profile to complete setup.
					</Field.Description>
				{/if}

				{#if errorMessage}
					<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
				{/if}

				<Field.Field orientation="horizontal" class="justify-end">
					{#if step === 'code'}
						<Button type="button" variant="outline" disabled={isSubmitting} onclick={onBackToEmail}>
							Change email
						</Button>
					{/if}
					<Button
						type="submit"
						disabled={missingName ||
							isSubmitting ||
							emailAvailability === 'checking' ||
							(step === 'email' && emailAvailability === 'unavailable')}
					>
						{#if isSubmitting}<Spinner data-icon="inline-start" />{/if}
						{step === 'email' ? 'Send code' : step === 'code' ? 'Save account' : 'Finish setup'}
					</Button>
				</Field.Field>
			</Field.Group>
		</form>
	</Dialog.Content>
</Dialog.Root>
