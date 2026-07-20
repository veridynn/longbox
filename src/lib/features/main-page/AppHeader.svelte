<script lang="ts">
	import { LogOut, Save, Settings, UserRound } from '@lucide/svelte';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import logo from '$lib/assets/longbox-logo.svg';

	type Props = {
		isGuest: boolean;
		onOpenAccount: () => void;
		onOpenProfile: () => void;
		onSaveAccount: () => void;
		profileImageSrc: string;
		profileName: string;
		signedIn: boolean;
		onSignOut: () => void;
	};

	let {
		isGuest,
		onOpenAccount,
		onOpenProfile,
		onSaveAccount,
		profileImageSrc,
		profileName,
		signedIn,
		onSignOut
	}: Props = $props();
</script>

<header
	class="sticky top-0 z-40 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-lg"
>
	<div
		class="mx-auto flex w-full max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:px-10"
	>
		<div class="flex items-center gap-3">
			<img class="size-11 rounded-md" src={logo} alt="" />
			<span class="text-2xl font-semibold tracking-normal">Longbox</span>
		</div>

		{#if signedIn}
			<div class="flex flex-wrap items-center gap-2">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						aria-label="Open account menu"
						class="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
					{#key Boolean(profileImageSrc)}
						<Avatar.Root size="lg">
							{#if profileImageSrc}
								<Avatar.Image src={profileImageSrc} alt={profileName || 'Profile picture'} />
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
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56" preventScroll={false}>
						<DropdownMenu.Label>
							<p class="truncate">{profileName || (isGuest ? 'Guest' : 'Account')}</p>
						</DropdownMenu.Label>
						<DropdownMenu.Separator />
						{#if isGuest}
							<DropdownMenu.Group>
								<DropdownMenu.Item onSelect={onSaveAccount}>
									<Save />
									Save account
								</DropdownMenu.Item>
							</DropdownMenu.Group>
						{:else}
							<DropdownMenu.Group>
								<DropdownMenu.Item onSelect={onOpenProfile}>
									<UserRound />
									Profile
								</DropdownMenu.Item>
								<DropdownMenu.Item onSelect={onOpenAccount}>
									<Settings />
									Account
								</DropdownMenu.Item>
							</DropdownMenu.Group>
						{/if}
						<DropdownMenu.Separator />
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
