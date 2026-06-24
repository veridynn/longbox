export type CustomListSummary = {
	coverImageUrls: string[];
	id: string;
	issueCount: number;
	name: string;
};

const RESERVED_LIST_NAMES = ['library', 'favorites', 'watchlist'];

function normalizedListName(name: string) {
	return name.trim().toLowerCase();
}

export function validateListName(name: string, existingNames: string[]) {
	const trimmedName = name.trim();

	if (!trimmedName) {
		return 'Enter a list name.';
	}

	const normalizedName = normalizedListName(trimmedName);
	if (
		RESERVED_LIST_NAMES.includes(normalizedName) ||
		existingNames.some((existingName) => normalizedListName(existingName) === normalizedName)
	) {
		return 'A list with this name already exists.';
	}

	return null;
}

export function customListItemKey(listKey: string, userIssueId: string) {
	return `${listKey}:userIssue:${userIssueId}`;
}
