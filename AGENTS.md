# Longbox Agent Guide

Longbox is a SvelteKit comic-library PWA using Svelte 5, Tailwind CSS 4, InstantDB, ComicVine, Vite+, Vitest, and Playwright.

## Read When Relevant

Use focused docs only when the task touches that area:

- `docs/agents/instantdb.md` - InstantDB schema, permissions, auth, storage, queries, admin SDK
- `docs/agents/svelte.md` - Svelte 5 and SvelteKit conventions
- `docs/agents/comicvine.md` - ComicVine API normalization and import behavior

If a change makes any of these docs inaccurate, update the relevant doc in the same change.

## Commands

Use Vite+:

- `vp install`
- `vp dev`
- `vp build`
- `vp check`
- `vp test`
- `vp run test:e2e` when e2e coverage is relevant

Prefer `vp` over direct package-manager, Vite, Vitest, or Playwright commands.

## Critical Rules

- Do not expose secrets from `.env`.
