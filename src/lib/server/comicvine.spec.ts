import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({
  env: {
    COMIC_VINE_API_KEY: "test-key",
  },
}));

import {
  ComicVineError,
  normalizeIssueDetail,
  normalizeSearchIssue,
  normalizeVolumeDetail,
  searchComicVineIssues,
} from "./comicvine";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ComicVine normalization", () => {
  it("normalizes issue search results", () => {
    expect(
      normalizeSearchIssue({
        id: "123",
        name: "The Last Laugh",
        issue_number: "7",
        cover_date: "2025-02-01",
        image: { medium_url: "https://img.example/issue.jpg" },
        volume: { id: "456", name: "Detective Comics" },
        site_detail_url: "https://comicvine.example/issue",
      }),
    ).toEqual({
      id: 123,
      name: "The Last Laugh",
      issueNumber: "7",
      coverDate: "2025-02-01",
      coverImageUrl: "https://img.example/issue.jpg",
      volume: {
        id: 456,
        name: "Detective Comics",
      },
      apiDetailUrl: null,
      siteDetailUrl: "https://comicvine.example/issue",
    });
  });

  it("normalizes issue details with characters and credit roles", () => {
    const issue = normalizeIssueDetail({
      id: 123,
      name: "",
      issue_number: "7",
      cover_date: "2025-02-01",
      store_date: "2025-01-15",
      image: { small_url: "https://img.example/small.jpg" },
      description: "<p>Story</p>",
      deck: "Short summary",
      volume: { id: 456, name: "Detective Comics" },
      character_credits: [
        { id: 1, name: "Batman", image: { icon_url: "https://img.example/batman.jpg" } },
        { id: null, name: "Ignored" },
      ],
      person_credits: [
        { id: 2, name: "Jane Writer", role: "writer, editor" },
        { id: 3, name: "No Role" },
      ],
    });

    expect(issue.name).toBeNull();
    expect(issue.coverImageUrl).toBe("https://img.example/small.jpg");
    expect(issue.characters).toEqual([
      { id: 1, name: "Batman", imageUrl: "https://img.example/batman.jpg" },
    ]);
    expect(issue.credits).toEqual([
      { id: 2, name: "Jane Writer", roles: ["writer", "editor"] },
      { id: 3, name: "No Role", roles: ["credit"] },
    ]);
  });

  it("normalizes volume publisher data", () => {
    expect(
      normalizeVolumeDetail({
        id: 456,
        name: "Detective Comics",
        start_year: "1937",
        status: "Continuing",
        deck: "The classic series",
        count_of_issues: "1000",
        image: { thumb_url: "https://img.example/volume.jpg" },
        publisher: { id: 10, name: "DC Comics" },
      }),
    ).toMatchObject({
      id: 456,
      name: "Detective Comics",
      startYear: "1937",
      status: "Continuing",
      issueCount: 1000,
      coverImageUrl: "https://img.example/volume.jpg",
      publisher: { id: 10, name: "DC Comics" },
    });
  });

  it("reports malformed ComicVine JSON as an upstream response error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
      }),
    );

    await expect(searchComicVineIssues("batman")).rejects.toThrow(
      new ComicVineError("ComicVine returned an invalid response."),
    );
  });
});
