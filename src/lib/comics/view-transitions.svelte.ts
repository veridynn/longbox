import type { LibraryIssue } from './types';

export type IssueTransitionPart = 'cover';
export type IssueTransitionDirection = 'issue-forward' | 'issue-back';
export type IssueTransitionPhase = 'idle' | 'capturing' | 'incoming';

export type IssueTransitionPreview = {
	coverImageUrl: string | null;
	issueId: string;
	listPosition: number | null;
	title: string;
};

type IssueTransitionState = {
	direction: IssueTransitionDirection | null;
	issueId: string | null;
	phase: IssueTransitionPhase;
	preview: IssueTransitionPreview | null;
};

type TransitionTarget = { url: URL } | null | undefined;
type TransitionNavigation = {
	from: TransitionTarget;
	to: TransitionTarget;
};
type TransitionIssue = Pick<
	LibraryIssue,
	'coverImageUrl' | 'id' | 'issueNumber' | 'name' | 'volume'
>;
type PrimeIssueTransitionOptions = {
	listPosition?: number;
};

const issueRoutePattern = /^\/issues\/([^/]+)\/?$/;

const state = $state<IssueTransitionState>({
	direction: null,
	issueId: null,
	phase: 'idle',
	preview: null
});

export const issueTransition = {
	get direction() {
		return state.direction;
	},
	get issueId() {
		return state.issueId;
	},
	get phase() {
		return state.phase;
	},
	get preview() {
		return state.preview;
	}
};

export function issueViewTransitionName(issueId: string, part: IssueTransitionPart) {
	return `issue-${part}-${safeCssIdentPart(issueId)}`;
}

export function isActiveIssueTransition(issueId: string) {
	return state.issueId === issueId;
}

export function getIssueTransitionPreview(issueId: string) {
	return state.preview?.issueId === issueId ? state.preview : null;
}

export function primeIssueTransition(
	issue: TransitionIssue,
	options: PrimeIssueTransitionOptions = {}
) {
	const existingPosition = state.preview?.issueId === issue.id ? state.preview.listPosition : null;

	state.issueId = issue.id;
	state.preview = issueTransitionPreview(issue, options.listPosition ?? existingPosition);
}

export function activateIssueTransition(navigation: TransitionNavigation) {
	const direction = issueTransitionDirection(navigation);
	const issueId = issueTransitionIssueId(navigation);

	if (!direction || !issueId) {
		return null;
	}

	state.direction = direction;
	state.issueId = issueId;
	state.phase = 'capturing';
	return { direction, issueId };
}

export function markIssueTransitionIncoming() {
	if (state.issueId) {
		state.phase = 'incoming';
	}
}

export function clearIssueTransition() {
	state.direction = null;
	state.issueId = null;
	state.phase = 'idle';
}

export function clearIssueTransitionPreview() {
	state.preview = null;
}

export function issueTransitionDirection(
	navigation: TransitionNavigation
): IssueTransitionDirection | null {
	const from = navigation.from?.url.pathname;
	const to = navigation.to?.url.pathname;

	if (from === '/' && Boolean(issueIdFromPath(to))) {
		return 'issue-forward';
	}

	if (Boolean(issueIdFromPath(from)) && to === '/') {
		return 'issue-back';
	}

	return null;
}

export function issueTransitionIssueId(navigation: TransitionNavigation) {
	return (
		issueIdFromPath(navigation.to?.url.pathname) ?? issueIdFromPath(navigation.from?.url.pathname)
	);
}

export function issueIdFromPath(pathname: string | undefined) {
	if (!pathname) {
		return null;
	}

	const match = issueRoutePattern.exec(pathname);
	if (!match) {
		return null;
	}

	try {
		return decodeURIComponent(match[1] ?? '');
	} catch {
		return match[1] ?? null;
	}
}

function issueTransitionPreview(
	issue: TransitionIssue,
	listPosition: number | null
): IssueTransitionPreview {
	return {
		coverImageUrl: issue.coverImageUrl ?? null,
		issueId: issue.id,
		listPosition,
		title: issueTitle(issue)
	};
}

function issueTitle(issue: TransitionIssue) {
	const volumeName = issue.volume?.name ?? 'Unknown volume';
	const issueName = issue.name ? `: ${issue.name}` : '';
	return `${volumeName} #${issue.issueNumber}${issueName}`;
}

function safeCssIdentPart(value: string) {
	const safeValue = value.replace(/[^a-zA-Z0-9_-]/g, '_');
	return safeValue || 'unknown';
}
