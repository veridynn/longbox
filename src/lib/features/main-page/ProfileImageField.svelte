<script lang="ts">
	import { X } from '@lucide/svelte';
	import { onDestroy } from 'svelte';
	import logo from '$lib/assets/longbox-logo.svg';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		disabled?: boolean;
		imageFile: File | null;
		inputId: string;
		open: boolean;
		profileImageSrc: string;
		removeImage: boolean;
	};

	let {
		disabled = false,
		imageFile = $bindable(),
		inputId,
		open,
		profileImageSrc = $bindable(),
		removeImage = $bindable()
	}: Props = $props();

	let imageError = $state<string | null>(null);
	let isDragging = $state(false);
	let dragDepth = 0;
	let previewUrl: string | null = null;

	function selectImage(file: File) {
		if (disabled) return;

		if (!file.type.startsWith('image/')) {
			imageError = `Unsupported image type: ${file.type || 'unknown'}.`;
			return;
		}

		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = URL.createObjectURL(file);
		profileImageSrc = previewUrl;
		imageFile = file;
		removeImage = false;
		imageError = null;
	}

	function removeProfileImage() {
		if (disabled) return;
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		profileImageSrc = '';
		imageFile = null;
		removeImage = true;
		imageError = null;
	}

	function handleFileChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) selectImage(file);
		input.value = '';
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		isDragging = false;
		const file = event.dataTransfer?.files[0];
		if (file) selectImage(file);
	}

	function isFileDrag(event: DragEvent) {
		return event.dataTransfer?.types.includes('Files') ?? false;
	}

	function handleWindowDragEnter(event: DragEvent) {
		if (!open || disabled || !isFileDrag(event)) return;
		event.preventDefault();
		dragDepth += 1;
		isDragging = true;
	}

	function handleWindowDragOver(event: DragEvent) {
		if (!open || disabled || !isFileDrag(event)) return;
		event.preventDefault();
		isDragging = true;
	}

	function handleWindowDragLeave(event: DragEvent) {
		if (dragDepth === 0) return;
		event.preventDefault();
		dragDepth = Math.max(0, dragDepth - 1);
		if (dragDepth === 0) isDragging = false;
	}

	function handleWindowDrop(event: DragEvent) {
		if (dragDepth === 0) return;
		event.preventDefault();
		dragDepth = 0;
		isDragging = false;
	}

	onDestroy(() => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});
</script>

<svelte:window
	ondragenter={handleWindowDragEnter}
	ondragleave={handleWindowDragLeave}
	ondragover={handleWindowDragOver}
	ondrop={handleWindowDrop}
/>

<Field.Field data-invalid={Boolean(imageError)}>
	<Field.Label class="sr-only" for={inputId}>Profile picture</Field.Label>
	<div class="relative w-full">
		<label
			for={inputId}
			aria-label="Upload profile picture"
			aria-disabled={disabled}
			data-dragging={isDragging}
			class={cn(
				'group flex min-h-40 w-full items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors',
				disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
				isDragging
					? 'border-muted-foreground/50 bg-muted/30 text-muted-foreground'
					: profileImageSrc
						? 'border-transparent'
						: 'border-transparent text-muted-foreground hover:border-muted-foreground/25 hover:bg-muted/30'
			)}
			ondrop={handleDrop}
		>
			{#key profileImageSrc}
				<Avatar.Root
					aria-label="Profile picture preview"
					class="size-20 ring-2 ring-accent ring-offset-2 ring-offset-background"
				>
					{#if profileImageSrc}
						<Avatar.Image src={profileImageSrc} alt="Profile picture preview" />
					{/if}
					<Avatar.Fallback>
						<img
							src={logo}
							alt="Longbox logo"
							class="size-full rounded-full object-cover grayscale opacity-50"
						/>
					</Avatar.Fallback>
				</Avatar.Root>
			{/key}
			{#if isDragging || !profileImageSrc}
				<span
					class={cn(
						'absolute bottom-1 flex flex-col items-center',
						!isDragging && 'opacity-0 transition-opacity group-hover:opacity-100'
					)}
				>
					<span>Drop image here to upload</span>
					{#if !isDragging}<span class="text-xs">or click to choose a file</span>{/if}
				</span>
			{/if}
		</label>
		{#if profileImageSrc && !isDragging}
			<Button
				type="button"
				variant="secondary"
				size="icon-xs"
				class="absolute top-1/2 left-1/2 -mt-10 ml-10 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-sm transition-none"
				aria-label="Remove profile picture"
				disabled={disabled}
				onclick={removeProfileImage}
			>
				<X />
			</Button>
		{/if}
	</div>
	<input
		id={inputId}
		class="sr-only"
		type="file"
		accept="image/*"
		aria-invalid={Boolean(imageError)}
		{disabled}
		onchange={handleFileChange}
	/>
	{#if imageError}<Field.Error>{imageError}</Field.Error>{/if}
</Field.Field>
