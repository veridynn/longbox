import { describe, expect, it } from "vitest";
import { characterNames } from "./format";
import type { LibraryItem } from "./types";

describe("comic display formatters", () => {
  it("falls back to stored ComicVine character credits when joins are empty", () => {
    const item: LibraryItem = {
      id: "list-item-1",
      position: 0,
      userIssue: {
        id: "user-issue-1",
        issue: {
          id: "issue-1",
          issueNumber: "26",
          rawComicVine: {
            character_credits: [
              { id: 1264, name: "Cosmic Boy" },
              { id: 182426, name: "Dr. Pharm" },
              { id: 13075, name: "General Zod" },
              { id: 182429, name: "Graft" },
              { id: 9606, name: "Lena Luthor" },
              { id: 16347, name: "Lesla-Lar" },
              { id: 41952, name: "Lex Luthor" },
              { id: 1253, name: "Lightning Lad" },
              { id: 6578, name: "Lobo" },
              { id: 1808, name: "Lois Lane" },
              { id: 182425, name: "Marilyn Moonlight" },
              { id: 9995, name: "Mercy Graves" },
              { id: 19179, name: "Mr. Terrific" },
              { id: 190205, name: "Myrrz" },
              { id: 34685, name: "Ray Palmer" },
              { id: 2352, name: "Ryan Choi" },
              { id: 1273, name: "Saturn Girl" },
              { id: 1807, name: "Superman" },
            ],
          },
          issueCharacters: [],
        },
      },
    };

    expect(characterNames(item)).toContain("Superman");
  });

  it("prefers normalized linked characters over raw ComicVine payloads", () => {
    const item: LibraryItem = {
      id: "list-item-1",
      position: 0,
      userIssue: {
        id: "user-issue-1",
        issue: {
          id: "issue-1",
          issueNumber: "26",
          rawComicVine: {
            character_credits: [{ id: 1807, name: "Superman" }],
          },
          issueCharacters: [
            {
              id: "appearance-1",
              character: {
                id: "character-1",
                name: "Superman Red",
              },
            },
          ],
        },
      },
    };

    expect(characterNames(item)).toEqual(["Superman Red"]);
  });

  it("reads linked character records when Instant returns one links as arrays", () => {
    const item: LibraryItem = {
      id: "list-item-1",
      position: 0,
      userIssue: {
        id: "user-issue-1",
        issue: {
          id: "issue-1",
          issueNumber: "26",
          issueCharacters: [
            {
              id: "appearance-1",
              character: [
                {
                  id: "character-1",
                  name: "Superman",
                },
              ],
            },
          ],
        },
      },
    };

    expect(characterNames(item)).toEqual(["Superman"]);
  });
});
