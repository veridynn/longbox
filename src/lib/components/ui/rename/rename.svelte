<script lang="ts" module>
	import type { TextElementTagNames } from './types.js';

	export type RenameProps<TagName extends TextElementTagNames> = {
		id?: string;
		this: TagName;
		inputTag?: 'input' | 'textarea';
		mode?: 'edit' | 'view';
		blurBehavior?: 'exit' | 'none';
		fallbackSelectionBehavior?: 'start' | 'end' | 'all';
		value: string;
		class?: string;
		inputClass?: string;
		textClass?: string;
		onSave?: (value: string) => boolean | void | Promise<boolean | void>;
		onCancel?: () => void;
		validate?: (value: string) => boolean;
	};
</script>

<script lang="ts" generics="TagName extends TextElementTagNames">
	import { cn } from '$lib/utils.js';
	import { box } from 'svelte-toolbelt';
	import { RenameInputState } from './rename-state.svelte.js';

	const uid = $props.id();
	let {
		id = uid,
		this: tagName,
		inputTag = 'input',
		mode = $bindable('view'),
		value = $bindable(),
		class: className,
		blurBehavior,
		fallbackSelectionBehavior = 'end',
		inputClass,
		textClass,
		onSave,
		onCancel,
		validate = () => true
	}: RenameProps<TagName> = $props();

	let inputRef = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);
	const renameState = new RenameInputState({
		mode: box.with(() => mode, (next) => (mode = next)),
		value: box.with(() => value, (next) => (value = next)),
		inputRef: box.with(() => inputRef, (next) => (inputRef = next)),
		blurBehavior: box.with(() => blurBehavior),
		fallbackSelectionBehavior: box.with(() => fallbackSelectionBehavior),
		onSave: (next) => onSave?.(next),
		onCancel: () => onCancel?.(),
		validate: (next) => validate(next)
	});

	const commonClass = 'min-w-0 w-full text-base';
	const inputProps = $derived({
		'data-mode': 'edit',
		id,
		class: cn(
			commonClass,
			'rounded-md border border-border outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20',
			className,
			inputClass
		),
		'aria-invalid': renameState.invalid,
		onkeydown: renameState.onInputKeydown,
		onblur: renameState.onInputBlur
	});
</script>

{#if mode === 'edit'}
	{#if inputTag === 'textarea'}
		<textarea bind:this={inputRef} bind:value={renameState.editingValue} {...inputProps}></textarea>
	{:else}
		<input
			bind:this={inputRef}
			bind:value={renameState.editingValue}
			type="text"
			autocomplete="off"
			{...inputProps}
		/>
	{/if}
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<svelte:element
		this={tagName as never}
		{id}
		data-mode="view"
		class={cn(commonClass, className, textClass)}
		onclick={renameState.onTextClick}
	>
		{value}
	</svelte:element>
{/if}
