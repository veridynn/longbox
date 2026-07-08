export type IssueListViewMode = 'gallery' | 'list';

const STORAGE_KEY = 'longbox.issueListViewMode';

export function isIssueListViewMode(value: string | null | undefined): value is IssueListViewMode {
	return value === 'list' || value === 'gallery';
}

export function storedIssueListViewMode(): IssueListViewMode {
	if (typeof localStorage === 'undefined') return 'gallery';

	const value = localStorage.getItem(STORAGE_KEY);
	return isIssueListViewMode(value) ? value : 'gallery';
}

export function storeIssueListViewMode(viewMode: IssueListViewMode) {
	localStorage.setItem(STORAGE_KEY, viewMode);
}
