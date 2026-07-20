<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { Dialog as DialogPrimitive } from "bits-ui";

	let { open = $bindable(false), ...restProps }: DialogPrimitive.RootProps = $props();
	let navigating = $state(false);

	onNavigate(() => {
		open = false;
		navigating = true;

		return () => {
			navigating = false;
		};
	});
</script>

{#if !navigating}
	<DialogPrimitive.Root bind:open {...restProps} />
{/if}
