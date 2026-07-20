<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import ProfileImageField from '$lib/features/main-page/ProfileImageField.svelte';

	type EmailAvailability = 'idle' | 'checking' | 'available' | 'unavailable';

	type Props = {
		email: string;
		emailAvailability: EmailAvailability;
		errorMessage: string | null;
		imageFile: File | null;
		isSubmitting: boolean;
		name: string;
		onCheckEmail: () => void;
		onEmailChange: () => void;
		onSubmitEmail: () => void;
		open: boolean;
		profileImageSrc: string;
		removeImage: boolean;
	};

	let {
		email = $bindable(),
		emailAvailability,
		errorMessage,
		imageFile = $bindable(),
		isSubmitting,
		name = $bindable(),
		onCheckEmail,
		onEmailChange,
		onSubmitEmail,
		open = $bindable(),
		profileImageSrc = $bindable(),
		removeImage = $bindable()
	}: Props = $props();

	let emailCheckTimeout: ReturnType<typeof setTimeout>;
	let missingName = $derived(!name.trim());

	function handleEmailInput(event: Event) {
		onEmailChange();
		clearTimeout(emailCheckTimeout);
		if (!(event.currentTarget as HTMLInputElement).validity.valid) return;
		emailCheckTimeout = setTimeout(onCheckEmail, 400);
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (missingName || isSubmitting) return;
		onSubmitEmail();
	}

	onDestroy(() => clearTimeout(emailCheckTimeout));
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Save account</Dialog.Title>
			<Dialog.Description>
				A display name and email are required. Your profile picture is optional.
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
						oninput={handleEmailInput}
					/>
					{#if emailAvailability === 'checking'}
						<Field.Description>Checking email availability…</Field.Description>
					{:else if emailAvailability === 'available'}
						<Field.Description>This email is available.</Field.Description>
					{:else if emailAvailability === 'unavailable'}
						<Field.Error>This email is already registered.</Field.Error>
					{/if}
				</Field.Field>

				{#if errorMessage}
					<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
				{/if}

				<Field.Field orientation="horizontal" class="justify-end">
					<Button
						type="submit"
						disabled={missingName ||
							isSubmitting ||
							emailAvailability === 'checking' ||
							emailAvailability === 'unavailable'}
					>
						{#if isSubmitting}<Spinner data-icon="inline-start" />{/if}
						Send code
					</Button>
				</Field.Field>
			</Field.Group>
		</form>
	</Dialog.Content>
</Dialog.Root>
