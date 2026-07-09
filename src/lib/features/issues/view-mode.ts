export const IssueListView = {
	Gallery: 'gallery',
	List: 'list'
} as const;

export type IssueListViewMode = (typeof IssueListView)[keyof typeof IssueListView];

export function isIssueListViewMode(value: string | null | undefined): value is IssueListViewMode {
	return value === IssueListView.List || value === IssueListView.Gallery;
}

export function resolvedIssueListViewMode(
	urlViewMode: string | null | undefined,
	savedViewMode: string | null | undefined,
	fallback: IssueListViewMode
) {
	if (isIssueListViewMode(urlViewMode)) return urlViewMode;
	if (isIssueListViewMode(savedViewMode)) return savedViewMode;
	return fallback;
}

export function storedIssueListViewMode(key: string) {
	try {
		const value = localStorage.getItem(key);
		return isIssueListViewMode(value) ? value : null;
	} catch {
		return null;
	}
}

export function saveIssueListViewMode(key: string, value: IssueListViewMode) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Ignore unavailable storage; the URL still carries the active state.
	}
}
