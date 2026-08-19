import type { CollectionItem } from '$lib/comics/types';

export const IssueSort = {
	Custom: 'custom',
	NewestAdded: 'newest-added',
	OldestAdded: 'oldest-added',
	IssueNumberDesc: 'issue-number-desc',
	IssueNumberAsc: 'issue-number-asc'
} as const;

const ISSUE_SORT_OPTIONS = [
	{ label: 'Custom order', value: IssueSort.Custom },
	{ label: 'Newest added', value: IssueSort.NewestAdded },
	{ label: 'Oldest added', value: IssueSort.OldestAdded },
	{ label: 'Issue # descending', value: IssueSort.IssueNumberDesc },
	{ label: 'Issue # ascending', value: IssueSort.IssueNumberAsc }
] as const;
const DEFAULT_SORT_OPTION =
	ISSUE_SORT_OPTIONS.find((option) => option.value === IssueSort.NewestAdded) ??
	ISSUE_SORT_OPTIONS[0];

export type IssueSortKey = (typeof IssueSort)[keyof typeof IssueSort];

const issueNumberCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const sortComparators = {
	[IssueSort.Custom]: () => 0,
	[IssueSort.NewestAdded]: (first, second) => addedTime(second) - addedTime(first),
	[IssueSort.OldestAdded]: (first, second) => addedTime(first) - addedTime(second),
	[IssueSort.IssueNumberDesc]: (first, second) =>
		issueNumberCollator.compare(
			second.userIssue?.issue?.issueNumber ?? '',
			first.userIssue?.issue?.issueNumber ?? ''
		),
	[IssueSort.IssueNumberAsc]: (first, second) =>
		issueNumberCollator.compare(
			first.userIssue?.issue?.issueNumber ?? '',
			second.userIssue?.issue?.issueNumber ?? ''
		)
} satisfies Record<IssueSortKey, (first: CollectionItem, second: CollectionItem) => number>;

export function issueSortOptions(userSortable: boolean) {
	return userSortable
		? ISSUE_SORT_OPTIONS
		: ISSUE_SORT_OPTIONS.filter((option) => option.value !== IssueSort.Custom);
}

export function isIssueSortKey(value: string | null | undefined): value is IssueSortKey {
	return ISSUE_SORT_OPTIONS.some((option) => option.value === value);
}

export function issueSortLabel(sortKey: IssueSortKey) {
	return (
		ISSUE_SORT_OPTIONS.find((option) => option.value === sortKey)?.label ??
		DEFAULT_SORT_OPTION.label
	);
}

export function resolvedIssueSortKey(
	urlSortKey: string | null | undefined,
	savedSortKey: string | null | undefined,
	fallback: IssueSortKey,
	userSortable = true
) {
	if (isAllowedIssueSortKey(urlSortKey, userSortable)) return urlSortKey;
	if (isAllowedIssueSortKey(savedSortKey, userSortable)) return savedSortKey;
	return fallback;
}

export function isAllowedIssueSortKey(
	value: string | null | undefined,
	userSortable: boolean
): value is IssueSortKey {
	return isIssueSortKey(value) && (userSortable || value !== IssueSort.Custom);
}

export function storedIssueSortKey(key: string, userSortable = true) {
	try {
		const value = localStorage.getItem(key);
		return isAllowedIssueSortKey(value, userSortable) ? value : null;
	} catch {
		return null;
	}
}

export function saveIssueSortKey(key: string, value: IssueSortKey) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Ignore unavailable storage; the URL still carries the active state.
	}
}

function timeValue(value: Date | null | undefined) {
	return value instanceof Date ? value.getTime() : Number.NEGATIVE_INFINITY;
}

function addedTime(item: CollectionItem) {
	return timeValue(item.addedAt ?? item.userIssue?.createdAt ?? item.userIssue?.acquiredAt);
}

export function sortedIssueItems(items: CollectionItem[], sortKey: IssueSortKey) {
	const compareItems = sortComparators[sortKey];

	return items
		.map((item, index) => ({ item, index }))
		.sort((first, second) => compareItems(first.item, second.item) || first.index - second.index)
		.map(({ item }) => item);
}
