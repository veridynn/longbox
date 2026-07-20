<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';

	let { open = $bindable(false), ...restProps }: AlertDialogPrimitive.RootProps = $props();
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
	<AlertDialogPrimitive.Root bind:open {...restProps} />
{/if}
