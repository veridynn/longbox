// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/svelte";

const _schema = i.schema({
  entities: {
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
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    characters: i.entity({
      comicVineId: i.number().unique().indexed().optional(),
      imageUrl: i.string().optional(),
      name: i.string().indexed(),
    }),
    genres: i.entity({
      name: i.string().unique().indexed(),
    }),
    issueCharacters: i.entity({}),
    issueCredits: i.entity({
      role: i.string().indexed(),
    }),
    issueGenres: i.entity({}),
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
    people: i.entity({
      comicVineId: i.number().unique().indexed().optional(),
      name: i.string().indexed(),
    }),
    profiles: i.entity({
      createdAt: i.date(),
      name: i.string().optional(),
      profileImageUrl: i.string().optional(),
      updatedAt: i.date(),
    }),
    publishers: i.entity({
      comicVineId: i.number().unique().indexed().optional(),
      name: i.string().indexed(),
    }),
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
    userListItems: i.entity({
      addedAt: i.date(),
      listItemKey: i.string().unique().indexed(),
      position: i.number().indexed(),
    }),
    userLists: i.entity({
      createdAt: i.date(),
      name: i.string().indexed(),
      updatedAt: i.date(),
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
  },
  links: {
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
  },
  rooms: {},
});

// This helps TypeScript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
