<script lang="ts">
	import { tick } from 'svelte';
	import { Pencil } from '@lucide/svelte';
	import { validateListName } from './lists';

	type Props = {
		class?: string;
		existingNames: string[];
		isSubmitting?: boolean;
		name: string;
		onRename: (name: string) => void | Promise<void>;
	};

	let {
		class: className = '',
		existingNames,
		isSubmitting = false,
		name,
		onRename
	}: Props = $props();

	let draftName = $state('');
	let errorMessage = $state<string | null>(null);
	let isEditing = $state(false);
	let inputElement = $state<HTMLInputElement | null>(null);

	export async function startEditing() {
		if (isSubmitting) return;

		draftName = name;
		errorMessage = null;
		isEditing = true;
		await tick();
		inputElement?.focus();
		inputElement?.select();
	}

	function cancelEditing() {
		draftName = name;
		errorMessage = null;
		isEditing = false;
	}

	async function saveName() {
		if (!isEditing || isSubmitting) return;

		const trimmedName = draftName.trim();
		const validationError = validateListName(trimmedName, existingNames, name);
		if (validationError) {
			errorMessage = validationError;
			return;
		}

		if (trimmedName === name) {
			cancelEditing();
			return;
		}

		try {
			await onRename(trimmedName);
			isEditing = false;
			errorMessage = null;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Unable to rename this list.';
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			void saveName();
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditing();
		}
	}
</script>

{#if isEditing}
	<div class="grid gap-1">
		<input
			bind:this={inputElement}
			bind:value={draftName}
			class="h-9 w-full rounded-md border border-input bg-input/30 px-2 text-sm font-medium outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 {className}"
			disabled={isSubmitting}
			maxlength="80"
			onblur={() => void saveName()}
			onkeydown={handleKeydown}
		/>
		{#if errorMessage}
			<p class="text-xs text-destructive">{errorMessage}</p>
		{/if}
	</div>
{:else}
	<button
		type="button"
		class="group inline-flex max-w-full items-center gap-1.5 text-left underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 {className}"
		disabled={isSubmitting}
		onclick={startEditing}
	>
		<span class="truncate">{name}</span>
		<Pencil class="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
	</button>
{/if}
