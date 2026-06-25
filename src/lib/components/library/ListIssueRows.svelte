<script lang="ts">
	import type { DragDropState } from '@thisux/sveltednd';
	import { draggable, droppable } from '@thisux/sveltednd';
	import type { LibraryItem } from '$lib/comics/types';
	import { flip } from 'svelte/animate';
	import SortableListIssueRow from './SortableListIssueRow.svelte';

	type Props = {
		items: LibraryItem[];
		onRemoveListItem: (itemId: string) => void | Promise<void>;
		onReorderListItems: (items: LibraryItem[]) => void | Promise<void>;
		removingItemIds?: string[];
	};

	let {
		items,
		onRemoveListItem,
		onReorderListItems,
		removingItemIds = []
	}: Props = $props();

	function hasSameOrder(firstItems: LibraryItem[], secondItems: LibraryItem[]) {
		return (
			firstItems.length === secondItems.length &&
			firstItems.every((item, index) => item.id === secondItems[index]?.id)
		);
	}

	function reorderedItemsForDrop(state: DragDropState<LibraryItem>) {
		const sourceId = state.draggedItem?.id;
		const targetIndex = Number(state.targetContainer);
		if (!sourceId || !Number.isInteger(targetIndex)) return items;

		const sourceIndex = items.findIndex((item) => item.id === sourceId);
		if (sourceIndex === -1) return items;

		const reorderedItems = [...items];
		const [movedItem] = reorderedItems.splice(sourceIndex, 1);
		const rawInsertIndex = targetIndex + (state.dropPosition === 'after' ? 1 : 0);
		const adjustedIndex = sourceIndex < rawInsertIndex ? rawInsertIndex - 1 : rawInsertIndex;
		const insertIndex = Math.max(0, Math.min(adjustedIndex, reorderedItems.length));

		reorderedItems.splice(insertIndex, 0, movedItem);
		return reorderedItems;
	}

	async function handleDrop(state: DragDropState<LibraryItem>) {
		const orderedItems = reorderedItemsForDrop(state);

		if (hasSameOrder(items, orderedItems)) {
			return;
		}

		await onReorderListItems(orderedItems);
	}
</script>

<ul class="divide-y divide-border">
	{#each items as item, index (item.id)}
		<li
			use:draggable={{
				container: 'list-issues',
				dragData: item,
				handle: '[data-list-drag-handle]',
				attributes: { draggingClass: 'opacity-80' }
			}}
			use:droppable={{
				container: String(index),
				direction: 'vertical',
				callbacks: { onDrop: handleDrop },
				attributes: {
					dragOverClass:
						'outline outline-2 outline-dashed outline-primary/60 outline-offset-[-2px]'
				}
			}}
			animate:flip={{ duration: 160 }}
			class="grid gap-4 bg-background transition sm:grid-cols-[auto_6rem_minmax(0,1fr)_auto]"
			data-list-issue-row={item.id}
		>
			<SortableListIssueRow {item} {onRemoveListItem} {removingItemIds} />
		</li>
	{/each}
</ul>

<style>
	:global(.drop-before)::before,
	:global(.drop-after)::after,
	:global(.drop-left)::before,
	:global(.drop-right)::after {
		display: none !important;
	}
</style>
