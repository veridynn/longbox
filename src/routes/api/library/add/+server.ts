import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { ComicVineError } from "$lib/server/comicvine";
import { importComicVineIssue, verifyInstantToken } from "$lib/server/library-import";

function bearerToken(header: string | null) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export const POST: RequestHandler = async ({ request }) => {
  const token = bearerToken(request.headers.get("authorization"));

  if (!token) {
    return json({ error: "Authentication is required." }, { status: 401 });
  }

  let body: { issueId?: unknown };

  try {
    body = (await request.json()) as { issueId?: unknown };
  } catch {
    return json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const issueId = Number(body.issueId);

  if (!Number.isInteger(issueId) || issueId <= 0) {
    return json({ error: "A valid ComicVine issue id is required." }, { status: 400 });
  }

  try {
    const user = await verifyInstantToken(token);
    const imported = await importComicVineIssue(user.id, issueId);
    return json({ imported });
  } catch (error) {
    if (error instanceof ComicVineError) {
      return json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Unable to add issue.";
    const status = message.toLowerCase().includes("token") ? 401 : 500;
    return json({ error: message }, { status });
  }
};
