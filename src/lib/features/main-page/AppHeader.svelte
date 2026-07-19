<script lang="ts">
	import { LogOut, Save, UserRound } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import logo from '$lib/assets/longbox-logo.svg';

	type Props = {
		isGuest: boolean;
		onSaveAccount: () => void;
		signedIn: boolean;
		onSignOut: () => void;
	};

	let { isGuest, onSaveAccount, signedIn, onSignOut }: Props = $props();
</script>

<header
	class="sticky top-0 z-40 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-lg"
>
	<div
		class="mx-auto flex w-full max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10"
	>
		<a class="flex items-center gap-3" href={resolve('/')}>
			<img class="size-11 rounded-md" src={logo} alt="" />
			<span class="text-2xl font-semibold tracking-normal">Longbox</span>
		</a>

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
	</div>
</header>
