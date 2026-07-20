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
	import AccountDialog from '$lib/features/main-page/AccountDialog.svelte';
	import AppHeader from '$lib/features/main-page/AppHeader.svelte';
	import DeleteAccountDialog from '$lib/features/main-page/DeleteAccountDialog.svelte';
	import ProfileDialog from '$lib/features/main-page/ProfileDialog.svelte';
	import { db } from '$lib/db';

	let { children } = $props();
	const auth = db.useAuth();
	const profileQuery = db.useQuery(() =>
		auth.user
			? {
					profiles: {
						$: {
							where: {
								'user.id': auth.user.id
							}
						}
					}
				}
			: null
	);
	const profileImageQuery = db.useQuery(() =>
		auth.user
			? {
					$files: {
						$: {
							where: {
								path: `${auth.user.id}/profile/avatar`
							}
						}
					}
				}
			: null
	);
	let activeViewTransition: ViewTransition | null = null;
	let accountOpen = $state(false);
	let deleteAccountOpen = $state(false);
	let deleteAccountError = $state<string | null>(null);
	let isDeletingAccount = $state(false);
	let profileOpen = $state(false);
	let profileName = $state('');
	let profileImageSrc = $state('');
	let profileImageFile = $state<File | null>(null);
	let profileImageRemoved = $state(false);
	let pendingProfileImage = $state<{
		previousId: string | null;
		previousUrl: string;
		remove: boolean;
		src: string;
	} | null>(null);
	let profileError = $state<string | null>(null);
	let isSavingProfile = $state(false);
	let saveAccountOpen = $state(false);
	let saveAccountEmail = $state('');
	let saveAccountCode = $state('');
	let saveAccountCodeSent = $state(false);
	let saveAccountError = $state<string | null>(null);
	let saveAccountEmailAvailability = $state<
		'idle' | 'checking' | 'available' | 'unavailable'
	>('idle');
	let saveAccountName = $state('');
	let saveAccountProfileImageSrc = $state('');
	let saveAccountProfileImageFile = $state<File | null>(null);
	let saveAccountProfileImageRemoved = $state(false);
	let saveAccountVerifiedUserId = $state<string | null>(null);
	let isSavingAccount = $state(false);
	let currentProfile = $derived(profileQuery.data?.profiles[0] ?? null);
	let currentProfileImage = $derived(profileImageQuery.data?.$files[0] ?? null);
	let pendingProfileImageSrc = $derived.by(() => {
		if (!pendingProfileImage) return null;
		if (pendingProfileImage.remove) return currentProfileImage ? pendingProfileImage.src : null;
		if (!currentProfileImage) return pendingProfileImage.src;

		return currentProfileImage.id !== pendingProfileImage.previousId ||
			currentProfileImage.url !== pendingProfileImage.previousUrl
			? null
			: pendingProfileImage.src;
	});
	let headerProfileImageSrc = $derived(
		profileOpen
			? profileImageSrc
			: (pendingProfileImageSrc ?? currentProfileImage?.url ?? '')
	);

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
		saveAccountName = currentProfile?.name ?? '';
		saveAccountProfileImageSrc = pendingProfileImageSrc ?? currentProfileImage?.url ?? '';
		saveAccountProfileImageFile = null;
		saveAccountProfileImageRemoved = false;
		saveAccountEmail = '';
		saveAccountCode = '';
		saveAccountCodeSent = false;
		saveAccountError = null;
		saveAccountEmailAvailability = 'idle';
		saveAccountVerifiedUserId = null;
		saveAccountOpen = true;
	}

	function openAccount() {
		accountOpen = true;
	}

	function openDeleteAccount() {
		deleteAccountError = null;
		deleteAccountOpen = true;
	}

	function cancelDeleteAccount() {
		deleteAccountError = null;
	}

	function openProfile() {
		profileName = currentProfile?.name ?? '';
		profileImageSrc = pendingProfileImageSrc ?? currentProfileImage?.url ?? '';
		profileImageFile = null;
		profileImageRemoved = false;
		profileError = profileQuery.error?.message ?? profileImageQuery.error?.message ?? null;
		profileOpen = true;
	}

	async function persistProfile(
		userId: string,
		profile: {
			imageFile: File | null;
			name: string;
			removeImage: boolean;
		}
	) {
		const now = new Date();
		const profileId = currentProfile?.id ?? userId;

		if (profile.imageFile) {
			await db.storage.uploadFile(`${userId}/profile/avatar`, profile.imageFile, {
				contentDisposition: 'inline',
				contentType: profile.imageFile.type
			});
		} else if (profile.removeImage && currentProfileImage) {
			await db.transact(db.tx.$files[currentProfileImage.id].delete());
		}

		await db.transact(
			db.tx.profiles[profileId]
				.update({
					createdAt: currentProfile?.createdAt ?? now,
					name: profile.name,
					updatedAt: now
				})
				.link({ user: userId })
		);
	}

	async function saveProfile(profile: {
		imageFile: File | null;
		name: string;
		removeImage: boolean;
	}) {
		if (!auth.user || isSavingProfile) return;

		isSavingProfile = true;
		profileError = null;
		const pendingImage =
			profile.imageFile || profile.removeImage
				? {
						previousId: currentProfileImage?.id ?? null,
						previousUrl: currentProfileImage?.url ?? '',
						remove: profile.removeImage,
						src: profileImageSrc
					}
				: null;

		try {
			await persistProfile(auth.user.id, profile);
			if (pendingImage) pendingProfileImage = pendingImage;
			profileOpen = false;
		} catch (error) {
			profileError = error instanceof Error ? error.message : 'Unable to save this profile.';
		} finally {
			isSavingProfile = false;
		}
	}

	async function deleteAccount(email: string, confirmation: string) {
		if (!auth.user?.refresh_token) {
			deleteAccountError = 'Authentication is required.';
			return;
		}

		isDeletingAccount = true;
		deleteAccountError = null;

		try {
			const response = await fetch('/api/account', {
				method: 'DELETE',
				headers: {
					authorization: `Bearer ${auth.user.refresh_token}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify({ email, confirmation })
			});

			if (!response.ok) {
				let message = 'Unable to delete this account.';

				try {
					const body = (await response.json()) as { error?: string };
					message = body.error ?? message;
				} catch {
					// Keep the fallback message for non-JSON responses.
				}

				throw new Error(message);
			}

			deleteAccountOpen = false;
			accountOpen = false;
			await db.auth.signOut({ invalidateToken: false });
		} catch (error) {
			deleteAccountError =
				error instanceof Error ? error.message : 'Unable to delete this account.';
		} finally {
			isDeletingAccount = false;
		}
	}

	function backToSaveAccountEmail() {
		saveAccountCode = '';
		saveAccountCodeSent = false;
		saveAccountError = null;
		saveAccountEmailAvailability = 'idle';
	}

	function handleSaveAccountEmailChange() {
		saveAccountEmailAvailability = 'idle';
		saveAccountError = null;
	}

	async function checkSaveAccountEmail() {
		const user = auth.user;
		const email = saveAccountEmail.trim().toLowerCase();

		if (!email) {
			saveAccountEmailAvailability = 'idle';
			return false;
		}

		if (!user?.isGuest || !user.refresh_token) {
			saveAccountError = 'A guest account is required.';
			return false;
		}

		saveAccountEmailAvailability = 'checking';

		try {
			const response = await fetch('/api/account/email-availability', {
				method: 'POST',
				headers: {
					authorization: `Bearer ${user.refresh_token}`,
					'content-type': 'application/json'
				},
				body: JSON.stringify({ email })
			});
			const body = (await response.json()) as { available?: boolean; error?: string };

			if (saveAccountEmail.trim().toLowerCase() !== email) return false;

			if (!response.ok) throw new Error(body.error ?? 'Unable to check this email.');

			saveAccountEmail = email;
			saveAccountEmailAvailability = body.available ? 'available' : 'unavailable';
			return Boolean(body.available);
		} catch (error) {
			saveAccountEmailAvailability = 'idle';
			saveAccountError =
				error instanceof Error ? error.message : 'Unable to check this email.';
			return false;
		}
	}

	async function sendSaveAccountCode() {
		const trimmedEmail = saveAccountEmail.trim();
		const trimmedName = saveAccountName.trim();
		saveAccountError = null;

		if (!trimmedName) {
			saveAccountError = 'Enter a display name.';
			return;
		}

		if (!trimmedEmail) {
			saveAccountError = 'Enter an email address.';
			return;
		}

		if (!(await checkSaveAccountEmail())) return;

		isSavingAccount = true;

		try {
			await db.auth.sendMagicCode({ email: saveAccountEmail });
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
		const guestUserId = auth.user?.isGuest ? auth.user.id : null;
		saveAccountError = null;

		if (!trimmedCode) {
			saveAccountError = 'Enter the code from your email.';
			return;
		}

		if (!saveAccountName.trim()) {
			saveAccountError = 'Enter a display name.';
			return;
		}

		if (!guestUserId || !(await checkSaveAccountEmail())) return;

		isSavingAccount = true;

		try {
			await db.auth.signInWithMagicCode({
				email: saveAccountEmail,
				code: trimmedCode
			});
			saveAccountVerifiedUserId = guestUserId;
			isSavingAccount = false;
			await finishGuestAccountProfile();
		} catch (error) {
			saveAccountError =
				error instanceof Error ? error.message : 'Unable to save this account.';
			if (!saveAccountVerifiedUserId) saveAccountCode = '';
		} finally {
			isSavingAccount = false;
		}
	}

	async function finishGuestAccountProfile() {
		if (!saveAccountVerifiedUserId || isSavingAccount) return;

		isSavingAccount = true;
		saveAccountError = null;

		try {
			await persistProfile(saveAccountVerifiedUserId, {
				imageFile: saveAccountProfileImageFile,
				name: saveAccountName.trim(),
				removeImage: saveAccountProfileImageRemoved
			});
			saveAccountOpen = false;
			saveAccountEmail = '';
			saveAccountCode = '';
			saveAccountCodeSent = false;
			saveAccountVerifiedUserId = null;
		} catch (error) {
			saveAccountError =
				error instanceof Error ? error.message : 'Unable to save your profile.';
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
		onOpenAccount={openAccount}
		onOpenProfile={openProfile}
		signedIn={Boolean(auth.user)}
		onSaveAccount={openSaveAccount}
		profileImageSrc={headerProfileImageSrc}
		profileName={currentProfile?.name ?? ''}
		onSignOut={() => db.auth.signOut()}
	/>
	<div class="flex-1">
		{@render children()}
	</div>
</div>

{#if auth.user}
	<ProfileDialog
		bind:name={profileName}
		bind:open={profileOpen}
		bind:imageFile={profileImageFile}
		bind:profileImageSrc
		bind:removeImage={profileImageRemoved}
		errorMessage={profileError}
		initialName={currentProfile?.name ?? ''}
		isSaving={isSavingProfile}
		onSubmit={saveProfile}
	/>
	<AccountDialog
		bind:open={accountOpen}
		email={auth.user.email ?? null}
		isGuest={Boolean(auth.user.isGuest)}
		onOpenDeleteAccount={openDeleteAccount}
	/>
	{#if !auth.user.isGuest && auth.user.email}
		<DeleteAccountDialog
			bind:open={deleteAccountOpen}
			email={auth.user.email}
			errorMessage={deleteAccountError}
			isDeleting={isDeletingAccount}
			onCancel={cancelDeleteAccount}
			onDeleteAccount={deleteAccount}
		/>
	{/if}
{/if}

<!-- TODO: Plan and implement monthly cleanup for guest accounts older than one month. -->
{#if auth.user?.isGuest || saveAccountOpen}
	<SaveAccountDialog
		bind:code={saveAccountCode}
		bind:email={saveAccountEmail}
		bind:imageFile={saveAccountProfileImageFile}
		bind:name={saveAccountName}
		bind:open={saveAccountOpen}
		bind:profileImageSrc={saveAccountProfileImageSrc}
		bind:removeImage={saveAccountProfileImageRemoved}
		codeSent={saveAccountCodeSent}
		emailAvailability={saveAccountEmailAvailability}
		errorMessage={saveAccountError}
		isSubmitting={isSavingAccount}
		onBackToEmail={backToSaveAccountEmail}
		onEmailBlur={checkSaveAccountEmail}
		onEmailChange={handleSaveAccountEmailChange}
		onSubmitCode={saveGuestAccount}
		onSubmitEmail={sendSaveAccountCode}
		onSubmitProfile={finishGuestAccountProfile}
		profilePending={Boolean(saveAccountVerifiedUserId)}
	/>
{/if}
<ConfirmDeleteDialog />
