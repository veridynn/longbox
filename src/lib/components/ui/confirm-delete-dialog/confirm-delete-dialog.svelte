<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Input } from "$lib/components/ui/input";
	import { dialogState } from "./confirm-delete-state.svelte.ts";
</script>

<AlertDialog.Root bind:open={dialogState.open}>
	<AlertDialog.Content>
		<form
			method="POST"
			onsubmit={(event) => {
				event.preventDefault();
				dialogState.confirm();
			}}
			class="flex flex-col gap-4"
		>
			<AlertDialog.Header>
				<AlertDialog.Title>
					{dialogState.options?.title}
				</AlertDialog.Title>
				<AlertDialog.Description>
					{dialogState.options?.description}
				</AlertDialog.Description>
			</AlertDialog.Header>
			{#if dialogState.options?.input}
				<Input
					bind:value={dialogState.inputText}
					placeholder={`Enter "${dialogState.options.input.confirmationText}" to confirm.`}
					onkeydown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							dialogState.confirm();
						}
					}}
				/>
			{/if}
			<AlertDialog.Footer>
				<AlertDialog.Cancel type="button" onclick={dialogState.cancel}>
					{dialogState.options?.cancel?.text ?? "Cancel"}
				</AlertDialog.Cancel>
				<AlertDialog.Action
					type="submit"
					variant="destructive"
					loading={dialogState.loading}
					disabled={dialogState.options?.input &&
						dialogState.inputText !==
							dialogState.options.input.confirmationText}
				>
					{dialogState.options?.confirm?.text ?? "Delete"}
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</form>
	</AlertDialog.Content>
</AlertDialog.Root>
