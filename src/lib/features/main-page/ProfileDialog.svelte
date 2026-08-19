<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';
	import ProfileImageField from './ProfileImageField.svelte';

	type ProfileInput = {
		imageFile: File | null;
		name: string;
		removeImage: boolean;
	};

	type Props = {
		errorMessage: string | null;
		imageFile: File | null;
		initialName: string;
		isSaving: boolean;
		name: string;
		onSubmit: (profile: ProfileInput) => void;
		open: boolean;
		profileImageSrc: string;
		removeImage: boolean;
	};

	let {
		errorMessage,
		imageFile = $bindable(),
		initialName,
		isSaving,
		name = $bindable(),
		onSubmit,
		open = $bindable(),
		profileImageSrc = $bindable(),
		removeImage = $bindable()
	}: Props = $props();

	let hasChanges = $derived(
		Boolean(imageFile) || removeImage || name.trim() !== initialName.trim()
	);
	function submitProfile(event: SubmitEvent) {
		event.preventDefault();
		onSubmit({ imageFile, name: name.trim(), removeImage });
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Profile</Dialog.Title>
		</Dialog.Header>

		<form onsubmit={submitProfile}>
			<Field.Group>
				<ProfileImageField
					bind:imageFile
					bind:profileImageSrc
					bind:removeImage
					inputId="profile-image"
					{open}
				/>

				<Field.Field>
					<Field.Label for="profile-name">Display name</Field.Label>
					<Input
						id="profile-name"
						bind:value={name}
						autocomplete="name"
						disabled={isSaving}
						maxlength={80}
					/>
				</Field.Field>

				{#if errorMessage}
					<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
				{/if}

				<Field.Field orientation="horizontal" class="justify-end">
					<Button type="submit" disabled={isSaving || !hasChanges}>
						{#if isSaving}<Spinner data-icon="inline-start" />{/if}
						Save
					</Button>
				</Field.Field>
			</Field.Group>
		</form>
	</Dialog.Content>
</Dialog.Root>
