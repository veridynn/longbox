// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/svelte";

const _schema = i.schema({
  entities: {
    // Instant system entities
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $streams: i.entity({
      abortReason: i.string().optional(),
      clientId: i.string().unique().indexed(),
      done: i.boolean().optional(),
      size: i.number().optional(),
    }),

    // User account data
    profiles: i.entity({
      createdAt: i.date(),
      name: i.string().optional(),
      profileImageUrl: i.string().optional(),
      updatedAt: i.date(),
    }),

    // Catalog hierarchy
    publishers: i.entity({
      comicVineId: i.number().unique().indexed().optional(),
      name: i.string().indexed(),
    }),
    volumes: i.entity({
      comicVineId: i.number().unique().indexed().optional(),
      coverImageUrl: i.string().optional(),
      dateLastSynced: i.date().optional(),
      issueCount: i.number().optional(),
      name: i.string().indexed(),
      startYear: i.string().optional(),
      status: i.string().optional(),
      summary: i.string().optional(),
    }),
    issues: i.entity({
      comicVineId: i.number().unique().indexed().optional(),
      coverDate: i.date().optional(),
      coverImageUrl: i.string().optional(),
      dateLastSynced: i.date().optional(),
      descriptionHtml: i.string().optional(),
      issueNumber: i.string().indexed(),
      name: i.string().optional(),
      rawComicVine: i.any().optional(),
      storeDate: i.date().optional(),
      summary: i.string().optional(),
    }),

    // Catalog dimensions
    people: i.entity({
      comicVineId: i.number().unique().indexed().optional(),
      name: i.string().indexed(),
    }),
    characters: i.entity({
      comicVineId: i.number().unique().indexed().optional(),
      imageUrl: i.string().optional(),
      name: i.string().indexed(),
    }),
    genres: i.entity({
      name: i.string().unique().indexed(),
    }),

    // Issue join data
    issueCredits: i.entity({
      creditKey: i.string().unique().indexed(),
      role: i.string().indexed(),
    }),
    issueCharacters: i.entity({
      issueCharacterKey: i.string().unique().indexed(),
    }),
    issueGenres: i.entity({}),

    // User library
    userIssues: i.entity({
      acquiredAt: i.date().optional(),
      createdAt: i.date(),
      favorite: i.boolean(),
      owned: i.boolean(),
      rating: i.number().optional(),
      readStatus: i.string().indexed(),
      updatedAt: i.date(),
      userIssueKey: i.string().unique().indexed(),
      userNote: i.string().optional(),
    }),
    userLists: i.entity({
      createdAt: i.date(),
      listKey: i.string().unique().indexed(),
      name: i.string().indexed(),
      updatedAt: i.date(),
    }),
    userListItems: i.entity({
      addedAt: i.date(),
      listItemKey: i.string().unique().indexed(),
      position: i.number().indexed(),
    }),
  },
  links: {
    // Instant system links
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    $streams$files: {
      forward: {
        on: "$streams",
        has: "many",
        label: "$files",
      },
      reverse: {
        on: "$files",
        has: "one",
        label: "$stream",
        onDelete: "cascade",
      },
    },

    // User account links
    $usersProfile: {
      forward: {
        on: "$users",
        has: "one",
        label: "profile",
        onDelete: "cascade",
      },
      reverse: {
        on: "profiles",
        has: "one",
        label: "user",
        onDelete: "cascade",
      },
    },

    // Catalog hierarchy links
    publishersVolumes: {
      forward: {
        on: "publishers",
        has: "many",
        label: "volumes",
      },
      reverse: {
        on: "volumes",
        has: "one",
        label: "publisher",
      },
    },
    volumesIssues: {
      forward: {
        on: "volumes",
        has: "many",
        label: "issues",
      },
      reverse: {
        on: "issues",
        has: "one",
        label: "volume",
      },
    },

    // Issue metadata links
    issuesCredits: {
      forward: {
        on: "issues",
        has: "many",
        label: "credits",
      },
      reverse: {
        on: "issueCredits",
        has: "one",
        label: "issue",
        onDelete: "cascade",
      },
    },
    peopleCredits: {
      forward: {
        on: "people",
        has: "many",
        label: "credits",
      },
      reverse: {
        on: "issueCredits",
        has: "one",
        label: "person",
      },
    },
    issuesIssueCharacters: {
      forward: {
        on: "issues",
        has: "many",
        label: "issueCharacters",
      },
      reverse: {
        on: "issueCharacters",
        has: "one",
        label: "issue",
        onDelete: "cascade",
      },
    },
    charactersIssueCharacters: {
      forward: {
        on: "characters",
        has: "many",
        label: "issueCharacters",
      },
      reverse: {
        on: "issueCharacters",
        has: "one",
        label: "character",
      },
    },
    issuesIssueGenres: {
      forward: {
        on: "issues",
        has: "many",
        label: "issueGenres",
      },
      reverse: {
        on: "issueGenres",
        has: "one",
        label: "issue",
        onDelete: "cascade",
      },
    },
    genresIssueGenres: {
      forward: {
        on: "genres",
        has: "many",
        label: "issueGenres",
      },
      reverse: {
        on: "issueGenres",
        has: "one",
        label: "genre",
      },
    },

    // User library links
    $usersUserIssues: {
      forward: {
        on: "$users",
        has: "many",
        label: "userIssues",
      },
      reverse: {
        on: "userIssues",
        has: "one",
        label: "owner",
        onDelete: "cascade",
      },
    },
    issuesUserIssues: {
      forward: {
        on: "issues",
        has: "many",
        label: "userIssues",
      },
      reverse: {
        on: "userIssues",
        has: "one",
        label: "issue",
      },
    },
    $usersUserLists: {
      forward: {
        on: "$users",
        has: "many",
        label: "userLists",
      },
      reverse: {
        on: "userLists",
        has: "one",
        label: "owner",
        onDelete: "cascade",
      },
    },
    userListsItems: {
      forward: {
        on: "userLists",
        has: "many",
        label: "items",
      },
      reverse: {
        on: "userListItems",
        has: "one",
        label: "list",
        onDelete: "cascade",
      },
    },
    userIssuesListItems: {
      forward: {
        on: "userIssues",
        has: "many",
        label: "listItems",
      },
      reverse: {
        on: "userListItems",
        has: "one",
        label: "userIssue",
        onDelete: "cascade",
      },
    },
  },
  rooms: {},
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
