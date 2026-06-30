import type { CollectionItem, SearchIssue } from '$lib/comics/types';
import { COLLECTION_NAME } from '$lib/collection';

export type CustomListSummary = {
	coverImageUrls: string[];
	createdAt: Date;
	id: string;
	issueCount: number;
	name: string;
	updatedAt: Date;
};

const RESERVED_LIST_NAMES = [COLLECTION_NAME.toLowerCase(), 'favorites', 'watchlist'];

function normalizedListName(name: string) {
	return name.trim().toLowerCase();
}

export function validateListName(name: string, existingNames: string[], currentName = '') {
	const trimmedName = name.trim();

	if (!trimmedName) {
		return 'Enter a list name.';
	}

	const normalizedName = normalizedListName(trimmedName);
	const normalizedCurrentName = normalizedListName(currentName);
	if (
		RESERVED_LIST_NAMES.includes(normalizedName) ||
		existingNames.some((existingName) => {
			const normalizedExistingName = normalizedListName(existingName);
			return (
				normalizedExistingName !== normalizedCurrentName &&
				normalizedExistingName === normalizedName
			);
		})
	) {
		return 'A list with this name already exists.';
	}

	return null;
}

export function stableUserIssueKey(ownerId: string, issueComicVineId: number) {
	return `${ownerId}:comicvine:${issueComicVineId}`;
}

export function customListItemKey(listKey: string, stableIssueKey: string) {
	return `${listKey}:userIssue:${stableIssueKey}`;
}

function comicVineIdForItem(item: CollectionItem) {
	const comicVineId = item.userIssue?.issue?.comicVineId;
	return typeof comicVineId === 'number' ? comicVineId : null;
}

export function listHasCollectionItem(
	listItems: CollectionItem[],
	item: CollectionItem,
	pendingUserIssueIds: string[]
) {
	const userIssueId = item.userIssue?.id;
	const comicVineId = comicVineIdForItem(item);
	const isPending = userIssueId ? pendingUserIssueIds.includes(userIssueId) : false;

	return (
		isPending ||
		listItems.some((listItem) => {
			const listUserIssueId = listItem.userIssue?.id;
			return (
				(Boolean(userIssueId) && listUserIssueId === userIssueId) ||
				(comicVineId !== null && comicVineIdForItem(listItem) === comicVineId)
			);
		})
	);
}

export function listHasSearchIssue(
	listItems: CollectionItem[],
	issue: SearchIssue,
	pendingIssueIds: number[]
) {
	return (
		pendingIssueIds.includes(issue.id) ||
		listItems.some((item) => item.userIssue?.issue?.comicVineId === issue.id)
	);
}

export function reorderedListItems(items: CollectionItem[], fromId: string, toId: string) {
	if (fromId === toId) {
		return [];
	}

	const fromIndex = items.findIndex((item) => item.id === fromId);
	const toIndex = items.findIndex((item) => item.id === toId);

	if (fromIndex === -1 || toIndex === -1) {
		return [];
	}

	const reorderedItems = [...items];
	const [movedItem] = reorderedItems.splice(fromIndex, 1);
	reorderedItems.splice(toIndex, 0, movedItem);

	return reorderedItems;
}

export function reorderedListPositions(items: CollectionItem[], fromId: string, toId: string) {
	return reorderedListItems(items, fromId, toId).map((item, position) => ({
		id: item.id,
		position
	}));
}

export function isDuplicateListItemError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	return /listItemKey|unique|already exists|duplicate/i.test(message);
}
