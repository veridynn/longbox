import type { CollectionItem, SearchIssue } from './types';

export function issueTitle(issue: SearchIssue) {
	const volumeName = issue.volume.name ?? 'Unknown volume';
	const issueName = issue.name ? `: ${issue.name}` : '';
	return `${volumeName} #${issue.issueNumber}${issueName}`;
}

export function formatDate(date: string | Date | null | undefined) {
	if (!date) return 'Unknown date';

	const value = date instanceof Date ? date : new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(value.valueOf())) return 'Unknown date';

	return new Intl.DateTimeFormat('en', {
		month: 'short',
		year: 'numeric'
	}).format(value);
}

export function groupedCredits(item: CollectionItem) {
	const credits = item.userIssue?.issue?.credits ?? [];
	const byRole: Record<string, string[]> = {};

	for (const credit of credits) {
		const personName = linkedName(credit.person);
		if (!personName) continue;

		byRole[credit.role] = [...(byRole[credit.role] ?? []), personName];
	}

	return Object.entries(byRole).map(
		([role, names]) => `${role}: ${Array.from(new Set(names)).join(', ')}`
	);
}

type RawCredit = {
	name?: unknown;
};

function rawComicVineObject(value: unknown) {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function rawCreditNames(value: unknown) {
	return Array.isArray(value)
		? value
				.map((credit: RawCredit) => (typeof credit.name === 'string' ? credit.name.trim() : ''))
				.filter(Boolean)
		: [];
}

function linkedName(value: { name: string } | Array<{ name: string }> | null | undefined) {
	const record = Array.isArray(value) ? value[0] : value;
	return record?.name;
}

export function characterNames(item: CollectionItem) {
	const linkedNames = Array.from(
		new Set(
			(item.userIssue?.issue?.issueCharacters ?? [])
				.map((appearance) => linkedName(appearance.character))
				.filter((name): name is string => Boolean(name))
		)
	);

	if (linkedNames.length) {
		return linkedNames;
	}

	const rawIssue = rawComicVineObject(item.userIssue?.issue?.rawComicVine);
	return Array.from(new Set(rawCreditNames(rawIssue?.character_credits)));
}
