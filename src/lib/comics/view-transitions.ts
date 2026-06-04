type IssueTransitionPart = 'cover' | 'title';

export function issueViewTransitionName(issueId: string, part: IssueTransitionPart) {
	const safeId = issueId.replace(/[^a-zA-Z0-9_-]/g, '_');
	return `issue-${part}-${safeId}`;
}
