# ![Longbox logo][longbox-logo] Longbox

Longbox is a local-first comic library for organizing a personal collection, keeping issue notes, building custom lists, and rediscovering what is already on the shelf.

## 🧰 Tech Stack

![svelte-typescript-vite-pnpm][tech-stack-icons]

- `SvelteKit 2`
- `Svelte 5`
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
