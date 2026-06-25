import { describe, expect, it } from 'vitest';
import {
	issueIdFromPath,
	issueTransitionDirection,
	issueTransitionIssueId,
	issueViewTransitionName
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

	it('detects library to issue detail transitions', () => {
		const nav = navigation('/', '/issues/issue-123');

		expect(issueTransitionDirection(nav)).toBe('issue-forward');
		expect(issueTransitionIssueId(nav)).toBe('issue-123');
	});

	it('detects issue detail to library transitions', () => {
		const nav = navigation('/issues/issue-123', '/');

		expect(issueTransitionDirection(nav)).toBe('issue-back');
		expect(issueTransitionIssueId(nav)).toBe('issue-123');
	});

	it('ignores unrelated transitions', () => {
		expect(issueTransitionDirection(navigation('/', '/demo'))).toBeNull();
		expect(issueTransitionDirection(navigation('/issues/one', '/issues/two'))).toBeNull();
	});
});
