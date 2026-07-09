# ![Longbox logo][longbox-logo] Longbox

Longbox is a personal comic collection manager for importing issues, tracking owned/read status, adding notes and ratings, and building custom lists.

## 🧰 Tech Stack

![svelte-typescript-vite-pnpm][tech-stack-icons]

- `Svelte 5 / SvelteKit 2`
- `TypeScript`
- `Vite Plus`
- `pnpm`

## 🚀 Quick Start

> [!IMPORTANT]
> Requires Node.js `24.16.0`, pnpm `11.5.1`, and Vite Plus `0.1.22`.
> Secrets are listed in `.env.example`.

```sh
vp install && vpr dev
```

## ☑️ Todo

- [ ] Disable caching for development enviorment so page refreshes always show the latest changes.
- [x] Separate development and production databases.
- [x] Move agent documentation from `docs` to `.agents/docs`, including a new home for `docs/assets/longbox-logo.svg`.
- [ ] Prevent duplicate collection issues
- [ ] Dev/prod InstantDB env split needs to be documented and verified end to end
- [ ] PWA caching still needs a dev-mode strategy
- [ ] Remove env file setup
- [ ] Fix back button from list page to issue detail page (leads to main page instead of back to list page)
- [ ] rework list component
  - [x] remove list title and unify list component (in list page you see title twice: page title and list title)
  - [x] add views
    - [x] gried view
    - [ ] list view
  - [ ] add edit mode
    - [ ] add dnd
    - [ ] add delete
      - [ ] Warn before removing a collection issue that is used in lists: show the affected lists, let the user delete or keep it, and bulk actions include a toggle to reuse that choice
  - [ ] add filters
  - [x] add search
  - [x] add sorts
  - [ ] how to handle custome order?
  - [ ] optemize image loading for big collection (not all at once)
  - [x] rating
    - [x] remove the fraction numeric display in issue detail page

## 🪲 Bugs

- [ ] back button should be a browser back and not just pointing to the main page
- [ ] tabing out of delete dialog closes it (should be trapped in dialog)

## 📜 Scripts

### Development server

Start the dev environment with injected secrets:

```sh
vpr dev
```

### Production

Build the application for production:

```sh
vp build
```

Preview the production build:

```sh
vp preview
```

### Check

Run Svelte and TypeScript checks:

```sh
vpr check
```

### Tests

Run the test suite:

```sh
vpr test
```

[longbox-logo]: docs/assets/longbox-logo.svg
[tech-stack-icons]: https://skillicons.dev/icons?i=svelte,ts,vite,pnpm
