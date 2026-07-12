<script lang="ts">
	import { BookOpen, LogOut, Save, UserRound } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';

	type Props = {
		isGuest: boolean;
		onSaveAccount: () => void;
		signedIn: boolean;
		onSignOut: () => void;
	};

	let { isGuest, onSaveAccount, signedIn, onSignOut }: Props = $props();
</script>

<header
	class="sticky top-0 z-40 -mt-6 flex flex-col gap-5 border-b border-border bg-background/95 py-4 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-lg md:flex-row md:items-center md:justify-between"
>
	<div class="flex items-center gap-3">
		<div class="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
			<BookOpen class="size-5" />
		</div>
		<div>
			<h1 class="text-2xl font-semibold tracking-normal">Longbox</h1>
		</div>
	</div>

	{#if signedIn}
		<div class="flex flex-wrap items-center gap-2">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					aria-label="Open account menu"
					class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<Avatar.Root size="lg">
						<Avatar.Fallback>
							<UserRound class="size-5" />
						</Avatar.Fallback>
					</Avatar.Root>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-40" preventScroll={false}>
					{#if isGuest}
						<DropdownMenu.Group>
							<DropdownMenu.Item onSelect={onSaveAccount}>
								<Save />
								Save account
							</DropdownMenu.Item>
						</DropdownMenu.Group>
					{/if}
					<DropdownMenu.Group>
						<DropdownMenu.Item onSelect={onSignOut}>
							<LogOut />
							Sign out
						</DropdownMenu.Item>
					</DropdownMenu.Group>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	{/if}
</header>
