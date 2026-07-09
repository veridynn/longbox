# AGENTS.md

## Purpose

Longbox is a local-first comic collection PWA for importing ComicVine issues, managing collection/list state in InstantDB, and editing issue metadata, notes, read status, and custom lists.

## Tech Stack

- Vite Plus
- TypeScript
- Svelte 5 runes, SvelteKit 2
- shadcn-svelte
- Tailwind CSS 4
- Runed
- InstantDB
- Vitest, Playwright
- Oxc

## Commands

vp install
vpx <package>
vpr dev
vpr check
vp test
vpr test
vp preview
vp build

## Rules

- Never use `npx`. Use `vpx` instead
- Do not overwrite user changes
- Run `vp check` after code changes; run focused tests when behavior changes

## Docs

Comic Vine API: `docs/agents/comic_vine_api.md`
InstantDB: `docs/agents/instantdb.md`
Svelte: `docs/agents/svelte.md`
