# Dependency Security Upgrade and Audit Remediation

## Problem Statement

The project currently installs a vulnerable dependency graph: `npm audit --json` reports 12 vulnerable package entries, including high-severity findings in the Next.js runtime path, Drizzle ORM, Vite/Vitest tooling, Rollup, Undici, and Picomatch. This work should upgrade the smallest practical set of direct dependencies, refresh the npm lockfile, and leave the app with no high-severity audit findings and a documented position for any unavoidable dev-only moderate advisory.

## Goals

- Remediate the current `npm audit` report without broad framework churn or unrelated refactors.
- Keep the app on Next 16, React 19, Drizzle ORM 0.45, Vitest 4, and Vite 7 unless the audit cannot be cleared safely within those lines.
- Regenerate `package-lock.json` with npm lockfile version 3 and verify the resolved graph, not only `package.json` ranges.
- Preserve current app behavior across the App Router pages, API routes, SQLite bootstrap, Drizzle access, and Vitest/jsdom tests.
- Document any residual advisory that cannot be eliminated because the upstream package has no fixed release.

## Non-Goals

- No migration to Next canary, React canary, Vite 8, or Drizzle Kit 1.0 beta unless the conservative path fails and the risk is explicitly accepted.
- No changes to database schema, generated Drizzle migrations, or application feature code unless a compatibility issue requires a small targeted fix.
- No replacement of `better-sqlite3`, Tailwind, Vitest, or the npm package manager.
- No use of `npm audit fix --force`; the current audit output suggests a `drizzle-kit` downgrade path that is not an acceptable remediation strategy.

## Current References

Relevant files and configuration:

- `package.json` uses npm scripts for `typecheck`, `lint`, `test`, and `build`.
- `package-lock.json` is npm lockfile version 3 and is the committed source of resolved transitive versions.
- `next.config.ts` uses Next 16 with `serverExternalPackages: ['better-sqlite3']`, a webpack watch override, and an empty `turbopack` config.
- `vitest.config.ts` uses `@vitejs/plugin-react`, `jsdom`, `src/__tests__/setup.ts`, and the `@` alias to `src`.
- `drizzle.config.ts` targets SQLite, `src/db/schema.ts`, and `src/db/migrations`.
- Runtime UUID usage imports `v4 as uuid` from `uuid`; no buffer-based v3/v5/v6 usage was found in the app paths.

Current direct dependency ranges from `package.json`:

| Area | Current direct package references |
| --- | --- |
| Framework | `next: 16.1.6`, `react: 19.2.3`, `react-dom: 19.2.3` |
| Data | `drizzle-orm: ^0.45.1`, `better-sqlite3: ^12.6.2`, `drizzle-kit: ^0.31.9` |
| IDs | `uuid: ^13.0.0` |
| Test/build tooling | `vitest: ^4.0.18`, `@vitest/coverage-v8: ^4.0.18`, `@vitejs/plugin-react: ^5.1.4`, `jsdom: ^28.1.0`, `postcss: ^8.5.9` |

Current resolved vulnerable nodes from `npm ls` and `npm audit --json`:

| Audit entry | Current resolved source | Severity | Audit range / advisory | Expected remediation |
| --- | --- | --- | --- | --- |
| `next` | direct `next@16.1.6` | high aggregate | Multiple Next 16 advisories, including `GHSA-q4gf-8mx6-v5v3` for Server Components DoS with range `<16.2.3`; other 16.x advisories fixed at `>=16.1.7`; audit suggests `next@16.2.6`. | Move to `next@16.2.6`; keep React 19 unless tests require a patch bump. |
| `drizzle-orm` | direct `drizzle-orm@0.45.1` | high | `GHSA-gpj5-g38j-94v9`, SQL identifier escaping, range `<0.45.2`. | Move to `drizzle-orm@^0.45.2`. |
| `vite` | transitive `vite@7.3.1` via Vitest/plugin-react | high aggregate | `GHSA-4w7w-66w2-5vf9`, `GHSA-v2wj-q39q-566r`, `GHSA-p9ff-h696-f583`, range `>=7.0.0 <=7.3.1`. | Add/pin `vite@^7.3.3` and update Vitest/plugin-react on compatible 4.x/5.x lines. |
| `rollup` | transitive `rollup@4.57.1` via Vite | high | `GHSA-mw96-cpmx-2vgc`, range `>=4.0.0 <4.59.0`. | Lockfile should resolve `rollup>=4.59.0`; use an override only if npm does not converge. |
| `undici` | transitive `undici@7.22.0` via `jsdom@28.1.0` | high aggregate | Multiple Undici 7 advisories with fixed range `>=7.24.0`. | Refresh lock to `undici>=7.24.0`; prefer this before a `jsdom` major bump. |
| `picomatch` | transitive `picomatch@4.0.3` via Vite/Vitest/tinyglobby | high aggregate | `GHSA-c2c7-rcm5-vvqj` and `GHSA-3v7f-55p6-f55p`, range `<4.0.4`. | Lockfile should resolve `picomatch>=4.0.4`; use an override only if needed. |
| `uuid` | direct `uuid@13.0.0` | moderate | `GHSA-w5hq-g745-h8pq`, range `>=13.0.0 <13.0.1`. | Move to `uuid@^13.0.1`; avoid v14 unless needed. |
| `postcss` | direct `postcss@8.5.9`; nested `next/node_modules/postcss@8.4.31` | moderate | `GHSA-qx2v-qp2m-jg93`, range `<8.5.10`. | Move direct `postcss` to `^8.5.14`; handle Next's exact nested PostCSS with an override only if audit still flags it. |
| `esbuild` | `@esbuild-kit/core-utils -> esbuild@0.18.20` via `drizzle-kit` | moderate | `GHSA-67mh-4wv8-2f99`, range `<=0.24.2`. | Try `drizzle-kit@^0.31.10`; if unresolved, consider a scoped override after Drizzle CLI checks. |

The audit count is 12 vulnerable package entries, not 12 unique GHSA records: `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `drizzle-kit`, `drizzle-orm`, `esbuild`, `next`, `picomatch`, `postcss`, `rollup`, `undici`, `uuid`, and `vite`.

## Proposed Upgrade Strategy

Use an incremental package-manager flow. After each step, inspect `package-lock.json` and run a targeted `npm ls` for the packages touched by that step.

1. Preflight:
   - Confirm the implementation branch starts clean except for intentional package changes: `git status --short`.
   - Confirm Node is at least `20.19.0`. README says "Use Node 20", but Vite 7.3.x and jsdom 28.x both require `^20.19.0 || >=22.12.0`; Next 16.2.6 requires `>=20.9.0`.
   - Capture baseline output for review: `npm audit --json > /tmp/rulers-audit-before.json` and `npm ls next react react-dom drizzle-orm drizzle-kit uuid vite vitest @vitejs/plugin-react @vitest/coverage-v8 postcss rollup undici picomatch esbuild`.

2. Upgrade direct runtime security fixes first:
   - `next`: set exact `16.2.6`, matching the existing exact-version style for Next.
   - `drizzle-orm`: set `^0.45.2`.
   - `uuid`: set `^13.0.1`.
   - `postcss`: set `^8.5.14` for the direct dev dependency.
   - Keep `react` and `react-dom` at `19.2.3` initially. `next@16.2.6` peers on `^19.0.0`, so React does not need to move for this security fix. If npm or tests force a React patch, move both together to exact `19.2.6`.

3. Upgrade test/build tooling on the current major lines:
   - Set `vitest` and `@vitest/coverage-v8` to `^4.1.5`.
   - Set `@vitejs/plugin-react` to `^5.2.0`.
   - Add an explicit dev dependency on `vite@^7.3.3` so npm does not opportunistically pull Vite 8 through broad peer ranges. Vite 8 should be a separate compatibility decision.
   - Refresh transitive resolutions so `rollup>=4.59.0`, `picomatch>=4.0.4`, and root/Vite `postcss>=8.5.10` are present in `package-lock.json`.

4. Upgrade Drizzle Kit conservatively:
   - Set `drizzle-kit` to `^0.31.10`, the current stable latest in the same line.
   - Do not accept the audit-suggested `drizzle-kit@0.18.1` path; it is a downgrade and would risk CLI/config compatibility.
   - If the `@esbuild-kit/core-utils -> esbuild@0.18.20` moderate advisory remains, test a scoped npm override:

     ```json
     {
       "overrides": {
         "@esbuild-kit/core-utils": {
           "esbuild": "0.25.12"
         }
       }
     }
     ```

     Keep this override only if `drizzle-kit` commands still work. If it fails, remove it and document the residual dev-only advisory as an upstream Drizzle Kit limitation.

5. Resolve remaining transitive findings with the smallest lockfile change:
   - For Undici, prefer refreshing the lock under current `jsdom@^28.1.0`, because jsdom 28 declares `undici:^7.21.0` and can accept `>=7.24.0`. Only move to `jsdom@^29.1.1` if npm cannot resolve a safe Undici under jsdom 28.
   - For Rollup and Picomatch, prefer normal lockfile convergence through `vite@^7.3.3` and Vitest updates. If audit still reports vulnerable versions, add top-level overrides:

     ```json
     {
       "overrides": {
         "rollup": "^4.59.0",
         "picomatch": "^4.0.4",
         "undici": "^7.25.0"
       }
     }
     ```

   - For Next's nested PostCSS, note that `next@16.2.6` still declares `postcss: 8.4.31`. If `npm audit` still reports `node_modules/next/node_modules/postcss`, add a narrow override and verify `next build`:

     ```json
     {
       "overrides": {
         "next": {
           "postcss": "8.5.14"
         }
       }
     }
     ```

     Track this as a temporary override and remove it when a stable Next release depends on `postcss>=8.5.10`.

6. Regenerate and normalize the lockfile:
   - Run `npm install --package-lock-only` after editing ranges.
   - Run `npm ci` from a clean install to prove the lockfile is sufficient.
   - Commit only `package.json` and `package-lock.json` for the implementation PR unless a small code compatibility fix is required.

## Compatibility Checks

### Next and React

- Verify `next@16.2.6` keeps the App Router routes under `src/app` working with React `19.2.3`.
- Run both development entry points at least to startup: `npm run dev` uses `next dev --webpack`, and `npm run dev:turbopack` covers the alternate Turbopack path.
- Confirm `next.config.ts` still externalizes `better-sqlite3` in production builds.
- If React is patched, keep `react` and `react-dom` exact and in sync. Current `@types/react@19.2.14` should remain compatible with React 19.2.x.

### Drizzle and SQLite

- Confirm `drizzle-orm@0.45.2` preserves imports from `drizzle-orm`, `drizzle-orm/sqlite-core`, and `drizzle-orm/better-sqlite3`.
- Re-run database-heavy tests because `src/db/index.ts` initializes SQLite through `initializeDatabaseSchema`, and app API routes rely on Drizzle query builders.
- If using the `@esbuild-kit/core-utils` override, run the Drizzle CLI against `drizzle.config.ts` and verify it reads the TypeScript config. Do not leave generated migration changes in the security PR unless the command intentionally created a required schema update.

### Vitest, Vite, and jsdom

- Keep Vite 7 first. `@vitejs/plugin-react@5.2.0` supports Vite 7 and 8, but an explicit `vite@^7.3.3` keeps this remediation scoped.
- Confirm `vitest.config.ts` still resolves `@` to `src`, uses the `jsdom` environment, and loads `src/__tests__/setup.ts`.
- If `jsdom` must move to 29.x to clear Undici, rerun all component tests and any tests that depend on DOM parsing, cookies, forms, or fetch behavior.

### UUID

- `uuid@13.0.1` preserves ESM named exports. Existing imports such as `import { v4 as uuid } from 'uuid';` should not need code changes.
- Do not jump to `uuid@14` for this ticket; it is outside the minimum security fix and should be handled separately if desired.

### Lockfile

- Validate resolved versions, not just ranges:

  ```bash
  npm ls next react react-dom drizzle-orm drizzle-kit uuid vite vitest @vitejs/plugin-react @vitest/coverage-v8 postcss rollup undici picomatch esbuild
  npm explain postcss
  npm explain esbuild
  npm explain undici
  ```

- The lockfile must not contain vulnerable resolved versions for high-severity entries: `next<16.2.3`, `drizzle-orm<0.45.2`, `vite<=7.3.1`, `rollup<4.59.0`, `undici<7.24.0`, or `picomatch<4.0.4`.

## Verification Plan

Run the full local gate:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
npm audit
```

Focused smoke tests:

- Start a fresh local database: `DATABASE_PATH=/tmp/rulers-security-smoke.db npm run dev`.
- Visit `/`, `/rules`, and `/maps`; confirm the pages render without client or server console errors.
- From `/`, create a new game through the UI. This exercises `uuid`, `better-sqlite3`, SQLite bootstrap, Drizzle inserts, cookies, and the App Router.
- After game creation, open `/game/[gameId]/setup` and `/game/[gameId]/gm`; confirm the session-aware layout and GM dashboard load.
- Use the join-by-code flow from the landing page in a clean browser session; confirm `/api/game/join-by-code` and `/api/auth/session` still work.
- After `npm run build`, run `PORT=3001 npm run start` and repeat the landing page plus create-game smoke in production mode.
- Optionally start `npm run dev:turbopack` and load `/` once to catch Vite/Vitest-independent Next/Turbopack regressions.

## Rollback and Risk Mitigation

- Keep the implementation PR scoped to dependency files. If a code compatibility fix is required, isolate it in a separate commit with a clear explanation.
- Prefer same-major updates and direct pins over broad `npm update` churn.
- Introduce npm `overrides` only after normal range updates fail to clear a vulnerable transitive node. Each override needs an `npm explain` note in the PR description and a comment to remove it when upstream catches up.
- If the build or smoke tests fail after a package step, revert that step's package range and lockfile changes, run `npm ci`, and retest before trying a broader upgrade.
- Runtime rollback is straightforward because this ticket should not ship DB migrations: redeploy the previous artifact or revert `package.json` and `package-lock.json`, remove `.next` and `node_modules`, then run `npm ci && npm run build`.
- If the Drizzle Kit esbuild advisory cannot be remediated safely, do not block high-severity fixes. Document it as a dev-only moderate residual with an upstream tracking issue and keep `npm audit --audit-level=high` green.

## Acceptance Criteria

- `package.json` contains the agreed upgraded direct ranges and no unreviewed major jumps.
- `package-lock.json` resolves the high-severity vulnerable packages to safe versions:
  - `next>=16.2.6`
  - `drizzle-orm>=0.45.2`
  - `vite>=7.3.3 <8`
  - `rollup>=4.59.0`
  - `undici>=7.24.0`
  - `picomatch>=4.0.4`
- `uuid` resolves to `13.0.1` or newer on the 13.x line.
- Direct `postcss` resolves to `>=8.5.10`; any Next nested PostCSS finding is either cleared by a tested override or explicitly documented as waiting on upstream Next.
- `npm audit --audit-level=high` exits successfully.
- `npm audit` exits successfully, or the only remaining finding is the documented Drizzle Kit / `@esbuild-kit` dev-only moderate advisory with an approved exception.
- `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass.
- Focused smoke tests for landing, rules, maps, game creation, join-by-code, setup, and GM dashboard pass in dev and production mode.

## Risks and Open Questions

- `next@16.2.6` is the current stable target for the Next advisories, but it still declares `postcss@8.4.31`; audit behavior must be checked after the lockfile refresh.
- `drizzle-kit@0.31.10` still depends on `@esbuild-kit/esm-loader`, whose `@esbuild-kit/core-utils` package depends on `esbuild~0.18.20`. A scoped override may work, but the Drizzle CLI must be verified before accepting it.
- Vite 8 is current latest, but moving there would also invite `@vitejs/plugin-react@6` and a larger build-tool change. Stay on Vite 7.3.3 unless audit data proves that line is insufficient.
- The repo has no `.nvmrc`, `.node-version`, or visible CI workflow pin in this checkout. If CI uses an older Node 20 minor, these upgrades may require a separate CI/runtime Node pin to `20.19.x` or newer.
- npm advisories can change between implementation and review. Re-run `npm audit` on the final branch and update the PR notes with the final advisory count.
