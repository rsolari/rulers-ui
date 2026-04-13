# Rulers UI

`Rulers UI` is a Next.js app for running and tracking a campaign of **Rulers**, a tabletop game about conquest, politics, trade, nobles, armies, and seasonal turn resolution.

The app gives a GM a dashboard for creating a game, setting up territories and realms, advancing turns, and reviewing events. Players join with a code and manage their own realm state through the browser.

## Stack

- Next.js 16 with the App Router
- React 19
- TypeScript
- Tailwind CSS 4
- SQLite via `better-sqlite3`
- Drizzle ORM
- Vitest for tests

## Repository Layout

- `src/app`: routes, pages, and API handlers
- `src/components`: shared UI primitives
- `src/lib`: game logic, auth helpers, and tests
- `src/db`: SQLite connection and Drizzle schema
- `rules`: markdown source material for the Rulers game rules
- `docs`: planning and implementation notes

## Running Locally

Use Node 20 to match CI.

1. Install dependencies:

```bash
npm ci
```

2. Start the development server:

```bash
npm run dev
```

3. Open `http://localhost:3000`.

If you see `Watchpack Error (watcher): Error: EMFILE: too many open files, watch`, run:

```bash
npm run dev
```

`npm run dev` is configured to use polling-based webpack watching in this repo, which avoids the `EMFILE` watcher overflow in some environments.

## Useful Commands

```bash
npm run dev
npm run dev:turbopack
npm run build
npm run start
npm run lint
npm test
npm run test:watch
npm run test:coverage
```

## Data Storage

The app uses a local SQLite database at `data/rulers.db` by default. If `DATABASE_PATH` is set, that path wins. If a mounted `/data` directory exists, the app prefers `/data/rulers.db` automatically so Railway-style persistent volumes still work when the env var is missing.

Fresh clones currently do not include checked-in migrations or a prebuilt database file. That means the UI can start with `npm run dev`, but game creation and other write flows need the SQLite schema from `src/db/schema.ts` to be applied before they will work end-to-end.

## Current Product Shape

- Landing page to create a game or join by code
- GM setup flow for territories, resources, realms, and settlements
- GM dashboard for overview, turn state, and events
- Realm-specific pages for treasury, nobles, trade, armies, settlements, and reports
- Server routes under `src/app/api` for game state reads and writes

## Notes

- CI runs `npm ci` and `npm test` on pushes and pull requests to `main`.
- There are no required environment variables in the current codebase.
