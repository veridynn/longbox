<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Spinner } from '$lib/components/ui/spinner/index.js';

	type Props = {
		email: string;
		errorMessage: string | null;
		isDeleting: boolean;
		onCancel: () => void;
		onDeleteAccount: (email: string, confirmation: string) => void | Promise<void>;
		open: boolean;
	};

	let {
		email,
		errorMessage,
		isDeleting,
		onCancel,
		onDeleteAccount,
		open = $bindable()
	}: Props = $props();

	let identityConfirmation = $state('');
	let deleteConfirmation = $state('');
	let canDelete = $derived(
		identityConfirmation === email && deleteConfirmation === 'delete my account'
	);

	function handleOpenChange(nextOpen: boolean) {
		if (nextOpen) return;
		identityConfirmation = '';
		deleteConfirmation = '';
		onCancel();
	}

	function submitDeletion(event: SubmitEvent) {
		event.preventDefault();
		if (!canDelete || isDeleting) return;
		void onDeleteAccount(identityConfirmation, deleteConfirmation);
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="sm:max-w-lg">
		<form class="flex flex-col gap-5" onsubmit={submitDeletion}>
			<Dialog.Header>
				<Dialog.Title>Delete account</Dialog.Title>
				<Dialog.Description>
					Your account will be deleted immediately. This cannot be undone.
				</Dialog.Description>
			</Dialog.Header>

			<Field.Group>
				<Field.Field>
					<Field.Label for="delete-account-email">
						Enter <code>{email}</code> to continue
					</Field.Label>
					<Input
						id="delete-account-email"
						bind:value={identityConfirmation}
						autocomplete="off"
						disabled={isDeleting}
					/>
				</Field.Field>
				<Field.Field>
					<Field.Label for="delete-account-confirmation">
						Type <code>delete my account</code> to confirm
					</Field.Label>
					<Input
						id="delete-account-confirmation"
						bind:value={deleteConfirmation}
						autocomplete="off"
						disabled={isDeleting}
					/>
				</Field.Field>
			</Field.Group>

			{#if errorMessage}
				<p class="text-sm text-destructive" role="alert">{errorMessage}</p>
			{/if}

			<Button
				type="submit"
				variant="destructive"
				class="w-full"
				disabled={!canDelete || isDeleting}
			>
				{#if isDeleting}<Spinner data-icon="inline-start" />{/if}
				Permanently delete account
			</Button>
		</form>
	</Dialog.Content>
</Dialog.Root>
