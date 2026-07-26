import type { CollectionIssue } from './types';

export type IssueTransitionPart = 'card-content' | 'cover';
export type IssueTransitionDirection = 'issue-forward' | 'issue-back';
export type IssueTransitionPhase = 'idle' | 'capturing' | 'incoming';

export type IssueTransitionPreview = {
	coverImageUrl: string | null;
	hasSharedCover: boolean;
	issueId: string;
	sourceHref: string;
	sourceLabel: string;
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
	CollectionIssue,
	'coverImageUrl' | 'id' | 'issueNumber' | 'name' | 'volume'
>;
type PrimeIssueTransitionOptions = {
	hasSharedCover?: boolean;
	sourceHref?: string;
	sourceLabel?: string;
};

const issueRoutePattern = /^\/issues\/([^/]+)\/?$/;
const issueListRoutePattern = /^\/(?:list\/[^/]+)?\/?$/;

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
	const existingPreview = state.preview?.issueId === issue.id ? state.preview : null;

	state.issueId = issue.id;
	state.preview = issueTransitionPreview(
		issue,
		options.hasSharedCover ?? existingPreview?.hasSharedCover ?? false,
		options.sourceHref ?? existingPreview?.sourceHref ?? '/',
		options.sourceLabel ?? existingPreview?.sourceLabel ?? 'Collection'
	);
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
	return {
		direction,
		hasSharedCover: state.preview?.issueId === issueId && state.preview.hasSharedCover,
		issueId
	};
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

	if (isIssueListPath(from) && Boolean(issueIdFromPath(to))) {
		return 'issue-forward';
	}

	if (Boolean(issueIdFromPath(from)) && isIssueListPath(to)) {
		return 'issue-back';
	}

	return null;
}

function isIssueListPath(pathname: string | undefined) {
	return Boolean(pathname && issueListRoutePattern.test(pathname));
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
	hasSharedCover: boolean,
	sourceHref: string,
	sourceLabel: string
): IssueTransitionPreview {
	return {
		coverImageUrl: issue.coverImageUrl ?? null,
		hasSharedCover,
		issueId: issue.id,
		sourceHref,
		sourceLabel,
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
