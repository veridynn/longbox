<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { flushSync } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import {
		activateIssueTransition,
		clearIssueTransition,
		issueTransitionDirection,
		markIssueTransitionIncoming
	} from '$lib/comics/view-transitions.svelte.ts';
	import { ConfirmDeleteDialog } from '$lib/components/ui/confirm-delete-dialog';
	import SaveAccountDialog from '$lib/features/auth/SaveAccountDialog.svelte';
	import AppHeader from '$lib/features/main-page/AppHeader.svelte';
	import { db } from '$lib/db';

	let { children } = $props();
	const auth = db.useAuth();
	let activeViewTransition: ViewTransition | null = null;
	let saveAccountOpen = $state(false);
	let saveAccountEmail = $state('');
	let saveAccountCode = $state('');
	let saveAccountCodeSent = $state(false);
	let saveAccountError = $state<string | null>(null);
	let isSavingAccount = $state(false);

	onNavigate((navigation) => {
		const direction = issueTransitionDirection(navigation);

		if (!direction) {
			return;
		}

		if (
			activeViewTransition ||
			!document.startViewTransition ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			clearIssueTransition();
			return;
		}

		const activated = flushSync(() => activateIssueTransition(navigation));
		if (!activated) {
			return;
		}

		document.documentElement.classList.add(activated.direction);

		return new Promise<void>((resolveOldStateCapture) => {
			const transition = document.startViewTransition({
				types: [activated.direction],
				update: async () => {
					resolveOldStateCapture();
					await navigation.complete;
					flushSync(markIssueTransitionIncoming);
				}
			});

			activeViewTransition = transition;

			void transition.finished.finally(() => {
				document.documentElement.classList.remove(activated.direction);
				activeViewTransition = null;
				clearIssueTransition();
			});
		});
	});

	function openSaveAccount() {
		saveAccountError = null;
		saveAccountOpen = true;
	}

	function backToSaveAccountEmail() {
		saveAccountCode = '';
		saveAccountCodeSent = false;
		saveAccountError = null;
	}

	async function sendSaveAccountCode() {
		const trimmedEmail = saveAccountEmail.trim();
		saveAccountError = null;

		if (!trimmedEmail) {
			saveAccountError = 'Enter an email address.';
			return;
		}

		isSavingAccount = true;

		try {
			await db.auth.sendMagicCode({ email: trimmedEmail });
			saveAccountEmail = trimmedEmail;
			saveAccountCode = '';
			saveAccountCodeSent = true;
		} catch (error) {
			saveAccountError =
				error instanceof Error ? error.message : 'Unable to send a sign-in code.';
		} finally {
			isSavingAccount = false;
		}
	}

	async function saveGuestAccount() {
		const trimmedCode = saveAccountCode.trim();
		saveAccountError = null;

		if (!trimmedCode) {
			saveAccountError = 'Enter the code from your email.';
			return;
		}

		isSavingAccount = true;

		try {
			await db.auth.signInWithMagicCode({
				email: saveAccountEmail,
				code: trimmedCode
			});
			saveAccountOpen = false;
			saveAccountEmail = '';
			saveAccountCode = '';
			saveAccountCodeSent = false;
		} catch (error) {
			saveAccountError =
				error instanceof Error ? error.message : 'Unable to save this account.';
			saveAccountCode = '';
		} finally {
			isSavingAccount = false;
		}
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<meta name="theme-color" content="#151716" />
	<meta
		name="description"
		content="A comic collection app for searching, importing, and managing your collection."
	/>
	<meta property="og:title" content="Longbox" />
	<meta property="og:type" content="website" />
	<meta
		property="og:description"
		content="A comic collection app for searching, importing, and managing your collection."
	/>
	<meta property="og:image" content={`${page.url.origin}/og-image.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="Longbox" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:image" content={`${page.url.origin}/og-image.png`} />
	<meta name="twitter:image:alt" content="Longbox" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-background text-foreground">
	<AppHeader
		isGuest={Boolean(auth.user?.isGuest)}
		signedIn={Boolean(auth.user)}
		onSaveAccount={openSaveAccount}
		onSignOut={() => db.auth.signOut()}
	/>
	<div class="flex-1">
		{@render children()}
	</div>
</div>

{#if auth.user?.isGuest}
	<SaveAccountDialog
		bind:code={saveAccountCode}
		bind:email={saveAccountEmail}
		bind:open={saveAccountOpen}
		codeSent={saveAccountCodeSent}
		errorMessage={saveAccountError}
		isSubmitting={isSavingAccount}
		onBackToEmail={backToSaveAccountEmail}
		onSubmitCode={saveGuestAccount}
		onSubmitEmail={sendSaveAccountCode}
	/>
{/if}
<ConfirmDeleteDialog />
