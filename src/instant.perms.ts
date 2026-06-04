// Docs: https://www.instantdb.com/docs/permissions

import type { InstantRules } from '@instantdb/svelte';

const rules = {
	userListItems: {
		allow: {
			view: "auth.id != null && auth.id in data.ref('list.owner.id') && auth.id in data.ref('userIssue.owner.id')",
			create:
				"auth.id != null && auth.id in data.ref('list.owner.id') && auth.id in data.ref('userIssue.owner.id')",
			delete:
				"auth.id != null && auth.id in data.ref('list.owner.id') && auth.id in data.ref('userIssue.owner.id')",
			update:
				"auth.id != null && auth.id in data.ref('list.owner.id') && auth.id in data.ref('userIssue.owner.id') && auth.id != null && auth.id in newData.ref('list.owner.id') && auth.id in newData.ref('userIssue.owner.id')"
		}
	},
	issueCharacters: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	},
	people: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	},
	volumes: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	},
	$users: {
		allow: {
			view: 'auth.id != null && auth.id == data.id',
			create: 'true',
			delete: 'false',
			update: 'auth.id != null && auth.id == data.id'
		}
	},
	userLists: {
		allow: {
			view: "auth.id != null && auth.id in data.ref('owner.id')",
			create: "auth.id != null && auth.id in data.ref('owner.id')",
			delete: "auth.id != null && auth.id in data.ref('owner.id')",
			update:
				"auth.id != null && auth.id in data.ref('owner.id') && auth.id != null && auth.id in newData.ref('owner.id')"
		}
	},
	profiles: {
		allow: {
			view: "auth.id != null && auth.id in data.ref('user.id')",
			create: "auth.id != null && auth.id in data.ref('user.id')",
			delete: "auth.id != null && auth.id in data.ref('user.id')",
			update:
				"auth.id != null && auth.id in data.ref('user.id') && auth.id != null && auth.id in newData.ref('user.id')"
		}
	},
	characters: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	},
	issueGenres: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	},
	$default: {
		allow: {
			$default: 'false'
		}
	},
	publishers: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	},
	genres: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	},
	issues: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	},
	userIssues: {
		allow: {
			view: "auth.id != null && auth.id in data.ref('owner.id')",
			create: "auth.id != null && auth.id in data.ref('owner.id')",
			delete: "auth.id != null && auth.id in data.ref('owner.id')",
			update:
				"auth.id != null && auth.id in data.ref('owner.id') && auth.id != null && auth.id in newData.ref('owner.id')"
		}
	},
	issueCredits: {
		allow: {
			view: 'auth.id != null',
			create: 'false',
			delete: 'false',
			update: 'false'
		}
	}
} satisfies InstantRules;

export default rules;
