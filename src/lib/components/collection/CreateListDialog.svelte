<script lang="ts">
	import { ListPlus, LoaderCircle } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	type Props = {
		errorMessage: string | null;
		isSubmitting: boolean;
		name: string;
		onCancel: () => void;
		onSubmit: () => void;
		open: boolean;
	};

	let {
		errorMessage,
		isSubmitting,
		name = $bindable(),
		onCancel,
		onSubmit,
		open = $bindable()
	}: Props = $props();

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		onSubmit();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Create a new list</Dialog.Title>
			<Dialog.Description>Give this list a name. You can add issues to it later.</Dialog.Description>
		</Dialog.Header>

		<form class="grid gap-4" onsubmit={handleSubmit}>
			<div class="grid gap-2">
				<label class="text-sm font-medium" for="new-list-name">List name</label>
				<div class="relative">
					<ListPlus class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<input
						id="new-list-name"
						bind:value={name}
						class="h-10 w-full rounded-md border border-input bg-input/30 pr-3 pl-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isSubmitting}
						maxlength="80"
						placeholder="Reading queue"
					/>
				</div>
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
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
					disabled={isSubmitting}
				>
					{#if isSubmitting}<LoaderCircle class="size-4 animate-spin" />{:else}<ListPlus class="size-4" />{/if}
					Create list
				</button>
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
