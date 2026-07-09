export type SearchIssue = {
	id: number;
	name: string | null;
	issueNumber: string;
	coverDate: string | null;
	coverImageUrl: string | null;
	volume: {
		id: number | null;
		name: string | null;
	};
	siteDetailUrl: string | null;
};

export type CollectionItem = {
	id: string;
	addedAt?: Date | null;
	position?: number;
	userIssue?: {
		id: string;
		acquiredAt?: Date | null;
		createdAt?: Date | null;
		favorite?: boolean;
		owned?: boolean;
		rating?: number | null;
		readStatus?: string;
		updatedAt?: Date | null;
		userNote?: string | null;
		listItems?: Array<{
			id: string;
			list?:
				| {
						id: string;
						name: string;
				  }
				| Array<{
						id: string;
						name: string;
				  }>
				| null;
		}>;
		issue?: CollectionIssue | null;
	} | null;
};

export type UserIssuePatch = {
	favorite?: boolean;
	owned?: boolean;
	rating?: number;
	readStatus?: 'read' | 'unread';
};

export type CollectionIssue = {
	id: string;
	name?: string | null;
	issueNumber: string;
	comicVineId?: number | null;
	coverDate?: Date | null;
	coverImageUrl?: string | null;
	descriptionHtml?: string | null;
	rawComicVine?: unknown;
	storeDate?: Date | null;
	summary?: string | null;
	volume?: {
		id: string;
		name: string;
		publisher?: {
			id: string;
			name: string;
		} | null;
	} | null;
	issueCharacters?: Array<{
		id: string;
		character?:
			| {
					id: string;
					name: string;
			  }
			| Array<{
					id: string;
					name: string;
			  }>
			| null;
	}>;
	credits?: Array<{
		id: string;
		role: string;
		person?:
			| {
					id: string;
					name: string;
			  }
			| Array<{
					id: string;
					name: string;
			  }>
			| null;
	}>;
};
