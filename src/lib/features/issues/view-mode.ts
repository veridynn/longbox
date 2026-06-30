export type IssueListViewMode = 'gallery' | 'list';

const STORAGE_KEY = 'longbox.issueListViewMode';

export function storedIssueListViewMode(): IssueListViewMode {
	if (typeof localStorage === 'undefined') return 'gallery';

	const value = localStorage.getItem(STORAGE_KEY);
	return value === 'list' || value === 'gallery' ? value : 'gallery';
}

export function storeIssueListViewMode(viewMode: IssueListViewMode) {
	localStorage.setItem(STORAGE_KEY, viewMode);
}
