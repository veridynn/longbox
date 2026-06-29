import { lookup } from '@instantdb/admin';
import { getAdminDb } from '$lib/server/instant-admin';
import {
	getComicVineIssue,
	getComicVineVolume,
	type ComicVineIssueDetail
} from '$lib/server/comicvine';
import { COLLECTION_NAME } from '$lib/collection';
import {
	creditKey,
	issueCharacterKey,
	recordIdForKey,
	userIssueKey
} from '$lib/server/import-keys';

type ImportedIssue = {
	issueId: string;
	alreadyInCollection: boolean;
	userIssueKey: string;
};

type TargetList = {
	id: string;
	listKey: string;
	name: string;
	items?: unknown[];
};

function parseDate(value: string | null) {
	if (!value) return null;

	const date = new Date(`${value}T00:00:00.000Z`);
	return Number.isNaN(date.valueOf()) ? null : date;
}

function firstName(...values: Array<string | null | undefined>) {
	return values.find((value) => value && value.trim()) ?? 'Unknown';
}

async function existingListItem(listItemKeyValue: string) {
	const adminDb = getAdminDb();
	const data = await adminDb.query({
		userListItems: {
			$: {
				where: {
					listItemKey: listItemKeyValue
				}
			}
		}
	});

	return data.userListItems[0] as { position?: number } | undefined;
}

async function existingUserIssue(userIssueKeyValue: string) {
	const adminDb = getAdminDb();
	const data = await adminDb.query({
		userIssues: {
			$: {
				where: {
					userIssueKey: userIssueKeyValue
				}
			}
		}
	});

	return data.userIssues[0] as { id?: string } | undefined;
}

async function ownedCustomList(ownerId: string, listId: string) {
	const adminDb = getAdminDb();
	const data = await adminDb.query({
		userLists: {
			$: {
				where: {
					id: listId,
					'owner.id': ownerId
				}
			},
			items: {}
		}
	});
	const list = data.userLists[0] as TargetList | undefined;

	if (!list || list.name === COLLECTION_NAME) {
		throw new Error('List not found.');
	}

	return list;
}

async function addUserIssueKeyToList(list: TargetList, userIssueKeyValue: string) {
	const adminDb = getAdminDb();
	const stableListItemKey = `${list.listKey}:userIssue:${userIssueKeyValue}`;

	if (await existingListItem(stableListItemKey)) {
		return stableListItemKey;
	}

	await adminDb.transact(
		adminDb.tx.userListItems[lookup('listItemKey', stableListItemKey)]
			.update({
				addedAt: new Date(),
				listItemKey: stableListItemKey,
				position: list.items?.length ?? 0
			})
			.link({
				list: list.id,
				userIssue: lookup('userIssueKey', userIssueKeyValue)
			})
	);

	return stableListItemKey;
}

export async function verifyInstantToken(token: string) {
	return getAdminDb().auth.verifyToken(token);
}

export async function importComicVineIssue(
	ownerId: string,
	issueComicVineId: number,
	targetListId?: string | null
): Promise<ImportedIssue> {
	const adminDb = getAdminDb();
	const inputUserIssueKey = userIssueKey(ownerId, issueComicVineId);
	const targetList = targetListId ? await ownedCustomList(ownerId, targetListId) : null;
	const currentUserIssue = await existingUserIssue(inputUserIssueKey);

	if (currentUserIssue) {
		if (targetList) {
			await addUserIssueKeyToList(targetList, inputUserIssueKey);
		}

		return {
			issueId: String(issueComicVineId),
			alreadyInCollection: true,
			userIssueKey: inputUserIssueKey
		};
	}

	const issue = await getComicVineIssue(issueComicVineId);
	const volume = issue.volume.id ? await getComicVineVolume(issue.volume.id) : null;
	const now = new Date();

	const publisher = volume?.publisher;
	const stableUserIssueKey = userIssueKey(ownerId, issue.id);
	type TransactionInput = Parameters<typeof adminDb.transact>[0];

	const transactions: Exclude<TransactionInput, readonly unknown[]>[] = [];

	if (publisher) {
		transactions.push(
			adminDb.tx.publishers[lookup('comicVineId', publisher.id)].update({
				name: publisher.name
			})
		);
	}

	if (volume) {
		const volumeTx = adminDb.tx.volumes[lookup('comicVineId', volume.id)].update({
			coverImageUrl: volume.coverImageUrl,
			dateLastSynced: now,
			issueCount: volume.issueCount,
			name: volume.name,
			startYear: volume.startYear,
			status: volume.status,
			summary: volume.summary
		});

		transactions.push(
			publisher ? volumeTx.link({ publisher: lookup('comicVineId', publisher.id) }) : volumeTx
		);
	}

	const issueTx = adminDb.tx.issues[lookup('comicVineId', issue.id)].update({
		coverDate: parseDate(issue.coverDate),
		coverImageUrl: issue.coverImageUrl,
		dateLastSynced: now,
		descriptionHtml: issue.descriptionHtml,
		issueNumber: issue.issueNumber,
		name: issue.name,
		rawComicVine: issue.raw,
		storeDate: parseDate(issue.storeDate),
		summary: issue.summary
	});

	transactions.push(volume ? issueTx.link({ volume: lookup('comicVineId', volume.id) }) : issueTx);

	for (const character of issue.characters) {
		const joinKey = issueCharacterKey(issue.id, character.id);
		transactions.push(
			adminDb.tx.characters[lookup('comicVineId', character.id)].update({
				imageUrl: character.imageUrl,
				name: character.name
			}),
			adminDb.tx.issueCharacters[recordIdForKey(joinKey)]
				.update({ issueCharacterKey: joinKey })
				.link({
					issue: lookup('comicVineId', issue.id),
					character: lookup('comicVineId', character.id)
				})
		);
	}

	for (const credit of issue.credits) {
		transactions.push(
			adminDb.tx.people[lookup('comicVineId', credit.id)].update({
				name: credit.name
			})
		);

		for (const role of credit.roles) {
			const stableCreditKey = creditKey(issue.id, credit.id, role);
			transactions.push(
				adminDb.tx.issueCredits[recordIdForKey(stableCreditKey)]
					.update({
						creditKey: stableCreditKey,
						role
					})
					.link({
						issue: lookup('comicVineId', issue.id),
						person: lookup('comicVineId', credit.id)
					})
			);
		}
	}

	transactions.push(
		adminDb.tx.userIssues[lookup('userIssueKey', stableUserIssueKey)]
			.update({
				createdAt: now,
				favorite: false,
				owned: true,
				readStatus: 'unread',
				updatedAt: now
			})
			.link({
				owner: ownerId,
				issue: lookup('comicVineId', issue.id)
			})
	);

	await adminDb.transact(transactions);

	if (targetList) {
		await addUserIssueKeyToList(targetList, stableUserIssueKey);
	}

	return {
		issueId: String(issue.id),
		alreadyInCollection: false,
		userIssueKey: stableUserIssueKey
	};
}

export function summarizeIssueForTests(issue: ComicVineIssueDetail) {
	return firstName(issue.name, issue.volume.name, `#${issue.issueNumber}`);
}
