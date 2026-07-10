<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import { flushSync, onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import {
		activateIssueTransition,
		clearIssueTransition,
		issueTransitionDirection,
		markIssueTransitionIncoming
	} from '$lib/comics/view-transitions.svelte.ts';
	import { ConfirmDeleteDialog } from '$lib/components/ui/confirm-delete-dialog';

	let { children } = $props();
	let activeViewTransition: ViewTransition | null = null;

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

	onMount(() => {
		void import('$lib/db');
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<meta name="theme-color" content="#151716" />
</svelte:head>
{@render children()}
<ConfirmDeleteDialog />
