<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	type Props = {
		email: string | null;
		isGuest: boolean;
		onOpenDeleteAccount: () => void;
		open: boolean;
	};

	let { email, isGuest, onOpenDeleteAccount, open = $bindable() }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Account</Dialog.Title>
		</Dialog.Header>

		<Field.Group>
			{#if !isGuest}
				<Field.Field>
					<Field.Label for="account-email">Email</Field.Label>
					<Input id="account-email" value={email ?? ''} readonly aria-readonly="true" />
				</Field.Field>

				<Field.Separator />

				<Field.Set>
					<Field.Legend class="text-destructive">Delete</Field.Legend>
					<Field.Description>
						Permanently delete my account and all associated data.
					</Field.Description>
					<Field.Field orientation="horizontal">
						<Button type="button" variant="destructive" onclick={onOpenDeleteAccount}>
							Delete account
						</Button>
					</Field.Field>
				</Field.Set>
			{/if}

			<Field.Field orientation="horizontal" class="justify-end">
				<Button type="button" onclick={() => (open = false)}>Close</Button>
			</Field.Field>
		</Field.Group>
	</Dialog.Content>
</Dialog.Root>
