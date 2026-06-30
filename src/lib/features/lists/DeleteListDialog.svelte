<script lang="ts">
	import { Check, Copy, LoaderCircle, Trash2 } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	type Props = {
		errorMessage: string | null;
		isSubmitting: boolean;
		listName: string;
		onCancel: () => void;
		onConfirm: () => void;
		open: boolean;
	};

	let {
		errorMessage,
		isSubmitting,
		listName,
		onCancel,
		onConfirm,
		open = $bindable()
	}: Props = $props();

	let confirmationName = $state('');
	let copied = $state(false);
	const canDelete = $derived(confirmationName === listName && !isSubmitting);

	$effect(() => {
		if (!open) {
			confirmationName = '';
			copied = false;
		}
	});

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (canDelete) {
			onConfirm();
		}
	}

	async function copyListName() {
		await navigator.clipboard?.writeText(listName);
		copied = true;
		window.setTimeout(() => {
			copied = false;
		}, 1200);
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete list</Dialog.Title>
			<Dialog.Description>
				This removes the list and its issue memberships. The issues stay in your collection.
			</Dialog.Description>
		</Dialog.Header>

		<form class="grid gap-4" onsubmit={handleSubmit}>
			<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
				Type
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-xs text-destructive hover:bg-destructive/15"
					aria-label={`Copy ${listName}`}
					onclick={copyListName}
				>
					{listName}
					{#if copied}<Check class="size-3" />{:else}<Copy class="size-3" />{/if}
				</button>
				to confirm deletion.
			</p>

			<div class="grid gap-2">
				<label class="text-sm font-medium" for="delete-list-confirmation">List name</label>
				<input
					id="delete-list-confirmation"
					bind:value={confirmationName}
					class="h-10 w-full rounded-md border border-input bg-input/30 px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={isSubmitting}
					autocomplete="off"
				/>
			</div>

			{#if errorMessage}
				<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{errorMessage}
				</p>
			{/if}

			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="inline-flex h-10 items-center justify-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
					disabled={isSubmitting}
					onclick={onCancel}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-destructive/10 px-4 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
					disabled={!canDelete}
				>
					{#if isSubmitting}<LoaderCircle class="size-4 animate-spin" />{:else}<Trash2 class="size-4" />{/if}
					Delete list
				</button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
