import { describe, expect, it } from 'vitest';
import {
	activateIssueTransition,
	clearIssueTransition,
	clearIssueTransitionPreview,
	getIssueTransitionPreview,
	issueIdFromPath,
	issueTransitionDirection,
	issueTransitionIssueId,
	issueViewTransitionName,
	primeIssueTransition
} from './view-transitions.svelte.ts';

function navigation(from: string, to: string) {
	return {
		from: { url: new URL(from, 'https://longbox.test') },
		to: { url: new URL(to, 'https://longbox.test') }
	};
}

describe('issue view transition helpers', () => {
	it('creates safe deterministic view transition names', () => {
		expect(issueViewTransitionName('abc 123/#4', 'cover')).toBe('issue-cover-abc_123__4');
		expect(issueViewTransitionName('', 'cover')).toBe('issue-cover-unknown');
	});

	it('reads issue ids from issue detail paths', () => {
		expect(issueIdFromPath('/issues/issue-123')).toBe('issue-123');
		expect(issueIdFromPath('/issues/encoded%20id/')).toBe('encoded id');
		expect(issueIdFromPath('/issues/issue-123/edit')).toBeNull();
		expect(issueIdFromPath('/')).toBeNull();
	});

	it('detects collection to issue detail transitions', () => {
		const nav = navigation('/', '/issues/issue-123');

		expect(issueTransitionDirection(nav)).toBe('issue-forward');
		expect(issueTransitionIssueId(nav)).toBe('issue-123');
	});

	it('detects custom list to issue detail transitions', () => {
		expect(issueTransitionDirection(navigation('/list/favorites', '/issues/issue-123'))).toBe(
			'issue-forward'
		);
		expect(issueTransitionDirection(navigation('/issues/issue-123', '/list/favorites'))).toBe(
			'issue-back'
		);
	});

	it('detects issue detail to collection transitions', () => {
		const nav = navigation('/issues/issue-123', '/');

		expect(issueTransitionDirection(nav)).toBe('issue-back');
		expect(issueTransitionIssueId(nav)).toBe('issue-123');
	});

	it('preserves the source page when details primes the return transition', () => {
		const issue = {
			coverImageUrl: 'https://img.example/cover.jpg',
			id: 'issue-123',
			issueNumber: '1',
			name: 'Book One',
			volume: { id: 'volume-1', name: 'Saga' }
		};

		primeIssueTransition(issue, {
			hasSharedCover: true,
			sourceHref: '/list/favorites?view=gallery',
			sourceLabel: 'Favorites'
		});
		primeIssueTransition(issue);

		expect(getIssueTransitionPreview(issue.id)).toMatchObject({
			hasSharedCover: true,
			sourceHref: '/list/favorites?view=gallery',
			sourceLabel: 'Favorites'
		});
		expect(
			activateIssueTransition(navigation('/list/favorites', '/issues/issue-123'))
		).toMatchObject({
			direction: 'issue-forward',
			hasSharedCover: true,
			issueId: 'issue-123'
		});

		clearIssueTransition();
		clearIssueTransitionPreview();
	});

	it('ignores unrelated transitions', () => {
		expect(issueTransitionDirection(navigation('/', '/demo'))).toBeNull();
		expect(issueTransitionDirection(navigation('/issues/one', '/issues/two'))).toBeNull();
	});
});
