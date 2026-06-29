# Comic Vine Agent Notes

Use this when changing Comic Vine search, issue import, volume import, metadata
normalization, attribution, caching, or error handling.

## Sources

- Official API landing page: https://comicvine.gamespot.com/api/
- Official resource documentation: https://comicvine.gamespot.com/api/documentation
- API developer forum: https://comicvine.gamespot.com/forums/api-developers-2334/

Prefer the official docs first. Use forum posts only for operational quirks and
validate current behavior before encoding assumptions in code.

## Terms And Limits

- Comic Vine requires a logged-in account and API key.
- API usage is non-commercial.
- Pages that show Comic Vine data should link back to Comic Vine.
- The official supported limit is 200 requests per resource per hour.
- Comic Vine also uses velocity detection, so bursts can cause temporary blocks
  even before hourly limits are exhausted.
- Cache responses and avoid duplicate unique requests.

For Longbox, this means imports should stay server-side, use narrow
`field_list` values, and avoid making repeated detail calls for data already in
the local InstantDB catalog.

## Request Basics

Base URL:

```text
https://comicvine.gamespot.com/api
```

Common query parameters:

- `api_key` - required API key.
- `format=json` - use JSON for Longbox.
- `field_list=a,b,c` - reduce payload size.
- `limit` - page size for list/search endpoints; defaults to 100 and cannot
  exceed 100 on documented list resources.
- `offset` - zero-based paging offset.
- `sort=field:asc` or `sort=field:desc` - only on sortable list fields.
- `filter=field:value` - only on filterable list fields.

Comic Vine returns an envelope, not raw results:

```ts
type ComicVineResponse<T> = {
	status_code?: number;
	error?: string;
	number_of_total_results?: number;
	number_of_page_results?: number;
	limit?: number;
	offset?: number;
	results?: T;
};
```

Known `status_code` values:

- `1` - OK
- `100` - invalid API key
- `101` - object not found
- `102` - URL format error
- `103` - JSONP format missing callback
- `104` - filter error
- `105` - subscriber-only video

Treat non-`1` status codes as API errors even when the HTTP status is 200.

## URL And ID Patterns

Single-resource API paths use resource prefixes:

- Issue detail: `/issue/4000-{issueId}/`
- Volume detail: `/volume/4050-{volumeId}/`

Website URLs use the same prefixed IDs, for example:

```text
https://comicvine.gamespot.com/some-title/4050-12345/
https://comicvine.gamespot.com/some-issue/4000-67890/
```

Store the numeric Comic Vine id separately from the prefixed URL id. Longbox
currently stores numeric `comicVineId` values and reconstructs API paths when
fetching details.

## Longbox Endpoints

Current implementation lives in `src/lib/server/comicvine.ts`.

Search:

```text
GET /search/
  query=<search text>
  resources=issue
  limit=12
  field_list=id,name,issue_number,cover_date,image,volume,api_detail_url,site_detail_url
```

Issue detail:

```text
GET /issue/4000-{issueId}/
  field_list=id,name,issue_number,cover_date,store_date,image,description,deck,volume,character_credits,person_credits
```

Volume detail:

```text
GET /volume/4050-{volumeId}/
  field_list=id,name,start_year,status,deck,description,count_of_issues,image,publisher
```

Keep these field lists narrow. Add fields only when the UI or InstantDB import
needs them.

## Important Fields

Issue fields used by Longbox:

- `id` - numeric issue id.
- `name` - issue title; may be empty.
- `issue_number` - issue number within the volume. Treat as a string because
  comics may use variants such as `0`, `1/2`, `1000`, or suffixes.
- `cover_date` - printed cover date.
- `store_date` - first sold date.
- `image` - image object with multiple sizes.
- `deck` - short summary.
- `description` - HTML description.
- `volume` - parent volume reference.
- `character_credits` - characters appearing in the issue.
- `person_credits` - people credited on the issue.
- `site_detail_url` - website URL for attribution/linkback.

Volume fields used by Longbox:

- `id` - numeric volume id.
- `name` - volume title.
- `start_year` - first year the volume appeared.
- `count_of_issues` - number of issues in the volume.
- `publisher` - primary publisher reference.
- `deck` / `description` - summary text.
- `image` - cover image object.

Image fields are nested. Prefer the best available size in this order unless a
specific UI has different needs:

```text
medium_url -> small_url -> thumb_url -> icon_url
```

## Normalization Rules

- Treat every external field as nullable.
- Trim strings; convert empty strings to `null`.
- Parse ids with `Number(...)`; reject missing ids for detail records.
- Keep issue numbers as strings.
- Parse Comic Vine dates as date-only UTC values when storing them as `Date`.
- Do not trust `count_of_issues` as a complete source of truth for collection
  logic; it is useful display metadata, not an import boundary.
- Preserve raw issue detail payloads only where useful for debugging or future
  re-normalization.
- Comic Vine descriptions are HTML. Do not render them without sanitization.

## Search Notes

`/search/` is useful for broad user-entered text, but it is not precise enough
for deterministic import decisions by itself. Prefer this flow:

1. Search issues by user query.
2. Show enough context for user choice: volume name, issue number, title, cover
   date, and cover image.
3. Import by selected numeric issue id.
4. Fetch issue detail and then volume detail server-side.

For exact volume/issue workflows, consider `/issues/` with filters only after
verifying the relevant fields are documented as filterable and the behavior is
stable for the target data.

## Error Handling

- Missing `COMIC_VINE_API_KEY` is a server configuration error.
- HTTP failures from Comic Vine should surface as upstream failures, not client
  validation errors.
- Non-OK Comic Vine `status_code` values should preserve a useful message but
  should not leak secrets or full request URLs.
- Timeouts and 5xx responses happen in practice. Keep UI copy recoverable and
  let users retry.
- Avoid logging API keys. If logging URLs, redact `api_key`.

## Rate-Limit Strategy

When expanding imports or background sync:

- Batch deliberately and cap concurrency.
- Add per-resource throttling before scaling imports.
- Cache by endpoint, id, field list, and relevant query parameters.
- Reuse existing InstantDB catalog records when `dateLastSynced` is fresh
  enough for the feature.
- Prefer user-triggered imports over automatic full-collection scraping unless a
  clear cache/throttle plan exists.

## Attribution

When displaying imported data, include a route to Comic Vine through
`site_detail_url` when available. If a view shows a list of imported Comic Vine
records, one visible attribution/link for the data source is usually the minimum
expected behavior.

## Testing Rules

- Unit tests must mock Comic Vine responses.
- Do not require a live API key in Vitest.
- Cover normalization for missing ids, empty strings, missing images, missing
  volume references, multiple credit roles, and invalid dates.
- Cover API route handling for missing query/body values, upstream errors, and
  non-OK Comic Vine status codes.
- Integration or manual tests that call Comic Vine should be explicit and not
  part of the default `vp test` path.
