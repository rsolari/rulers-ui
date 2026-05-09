# GM Dashboard Information Architecture

## Problem Statement

The GM dashboard at `src/app/game/[gameId]/gm/page.tsx` has grown into a single long client page that mixes setup readiness, player slot operations, realm management, world editing, settlement CRUD, building and troop overrides, transfers, turmoil, governance, and GOS management. The result is powerful but difficult to scan, hard to safely extend, and not shaped like a command center for running an active game.

This spec reorganizes the dashboard into clear GM workflows while preserving the current capabilities and API contracts.

## Goals

- Make `/game/[gameId]/gm` feel like a polished GM command center with a persistent status header, decision-oriented overview, and workflow tabs.
- Keep high-frequency GM actions easy to find: refresh, start game, mark GM ready, map, export, turn review, realm risk, settlement transfer, turmoil edits, and GOS/governance assignments.
- Split the current page into implementable components with domain ownership boundaries so future GM features do not extend the monolith.
- Preserve all existing GM-only behavior, authorization redirects, endpoint semantics, and mutation side effects.
- Reduce unnecessary data fetching by loading tab-specific data only when needed while keeping the overview fresh enough for live play.
- Improve keyboard, screen reader, and responsive behavior for the dashboard's dense management UI.

## Non-Goals

- Redesigning player realm pages such as `/game/[gameId]/realm`, `/realm/gos`, `/realm/army`, `/realm/settlements`, or `/realm/nobles`.
- Changing the database schema, DTO shape, game rules, economy formulas, turmoil rules, or turn action resolution semantics.
- Replacing existing APIs with a new backend aggregation endpoint as part of the first implementation. A small GM overview API can be considered later if client-side fetch pressure remains high.
- Rewriting the map renderer or territory generation flow.
- Adding a new data-fetching dependency. The repo currently uses plain `fetch`; keep the first pass dependency-free.

## Current-State References

- `src/app/game/[gameId]/gm/page.tsx:109` defines the `GMDashboard` client component and owns the route, role redirect, all dashboard state, all mutations, and most rendering.
- `src/app/game/[gameId]/gm/page.tsx:153` loads eight resources in one `loadDashboard()` call: game, realms, territories, player slots, economy overview, settlements, map, and all GOS.
- `src/app/game/[gameId]/gm/page.tsx:225` refreshes the entire dashboard every 5 seconds for all tabs, regardless of which workflow is visible.
- `src/app/game/[gameId]/gm/page.tsx:640` renders pre-start summary cards for GM code, player readiness, and next step.
- `src/app/game/[gameId]/gm/page.tsx:726` renders player slots and setup progress inline, with a link to `/game/[gameId]/gm/realm-slots`.
- `src/app/game/[gameId]/gm/page.tsx:810` embeds `GmTurnReviewPanel` directly into the main page when the game is active.
- `src/app/game/[gameId]/gm/page.tsx:812` begins the realm list and realm editor, including NPC realm creation, government/traditions/technical knowledge, territory assignment, capital placement, realm economy/turmoil badges, and nested active-game panels.
- `src/app/game/[gameId]/gm/page.tsx:1096` nests active-game `details` sections for governance, troops, and turmoil inside each realm card.
- `src/app/game/[gameId]/gm/page.tsx:1228` begins world management, which includes territory ownership, territory edits, settlement edits, settlement transfer, building deletion, GM building override, GM troop override, and settlement placement.
- `src/app/game/[gameId]/gm/page.tsx:1678` defines `RealmManagementEditor` in the same file. It manages noble families, nobles, GOS, GOS leaders, and building GOS owner/allotted assignment for a single realm.
- `src/app/game/[gameId]/gm/page.tsx:2279` defines `GovernanceRealmPanel` in the same file. It loads per-realm nobles, settlements, armies, and GOS, then edits heirs, governors, generals, GOS leaders, and noble status/activity.
- `src/app/game/[gameId]/gm/page.tsx:2639` defines `RealmTroopPanel` in the same file. It loads per-realm troops and supports troop selection and garrison transfer.
- `src/app/game/[gameId]/gm/page.tsx:2792` defines `GlobalGOSPanel` in the same file. It loads all GOS and links to `/game/[gameId]/realm/gos`.
- `src/app/game/[gameId]/gm/realm-slots/page.tsx:59` is already a dedicated GM subroute for slot preparation. The new dashboard should keep this route and make it the full editor for slot creation/preparation, not duplicate it.
- `src/components/ui/tabs.tsx` exists but is local-state only and is not URL-addressable. The GM dashboard needs a URL-synced tab state so GMs can deep-link to workflows.

Relevant APIs currently used by the GM dashboard:

- `GET /api/game/:gameId`
- `GET|POST|PATCH /api/game/:gameId/realms`
- `POST /api/game/:gameId/realms/place-capital`
- `POST|DELETE /api/game/:gameId/realms/turmoil`
- `GET|PATCH /api/game/:gameId/territories`
- `GET|POST|PATCH|DELETE /api/game/:gameId/settlements`
- `POST /api/game/:gameId/settlements/:settlementId/transfer`
- `GET /api/game/:gameId/player-slots`
- `GET /api/game/:gameId/economy/overview`
- `GET /api/game/:gameId/map`
- `GET|POST|PATCH /api/game/:gameId/gos`
- `POST /api/game/:gameId/gos/:gosId/leader`
- `GET|POST /api/game/:gameId/noble-families`
- `GET|POST /api/game/:gameId/nobles`
- `PATCH /api/game/:gameId/nobles/:nobleId`
- `GET|PATCH /api/game/:gameId/troops`
- `GET /api/game/:gameId/armies`
- `POST /api/game/:gameId/armies/:armyId/general`
- `POST /api/game/:gameId/governance/heir`
- `GET|POST|PATCH|DELETE /api/game/:gameId/buildings`
- `POST /api/game/:gameId/setup/gm-ready`
- `POST /api/game/:gameId/start`
- `GET /api/game/:gameId/export`

## Proposed IA

### Page Frame

`/game/[gameId]/gm` should have a stable dashboard frame:

1. Command header
   - Game name and "GM Command Center" subtitle.
   - Status badges: init state when not active/completed, GM setup state when relevant, game phase, season/year, turn phase.
   - Primary action group: `Mark GM Setup Ready`, `Start Game`, `Refresh`.
   - Utility action group: `Map`, `Export Database`.
2. Status summary band
   - Pre-start: GM code, player readiness, next blocked setup requirement.
   - Active/completed: turn queue status, unresolved resolutions count, high-turmoil realms count, GOS treasury total, world asset counts if available from loaded data.
3. URL-synced workflow tabs
   - Use `?tab=overview`, `?tab=setup`, etc. Preserve any selected `realmId` as a secondary query param where needed.
   - Default tab:
     - Before active: `setup`.
     - Active or completed: `overview`.
   - Hidden tabs should not be removed from direct links without a redirect. If a GM opens `?tab=setup` after the game is active, show a compact read-only setup archive instead of a blank page.

### Top-Level Tabs

#### 1. Overview

Purpose: quick GM situational awareness and launch points.

Sections:

- Command summary cards:
  - Current phase/season/year/turn.
  - Turn review/resolution queue status when active.
  - Realm risk count: turmoil threshold, winter unrest pending, open turmoil reviews, economy warnings.
  - Setup blockers when not active.
- Realm watch table:
  - Realm name, NPC/player badge, treasury, projected treasury, projected turmoil, warnings, open unrest/review, setup state if pre-start.
  - Row action opens the realm detail panel in the Realms tab through `?tab=realms&realmId=...`.
- Active-game turn review preview:
  - Reuse `GmTurnReviewPanel` only in full inside Turn Operations.
  - Overview can show a summary and link to Turn Operations. If no summary endpoint exists, omit the preview in the first pass instead of loading full turn data twice.
- Recent critical actions:
  - Out of scope for first pass unless existing turn/event data already provides it. Leave a placeholder component boundary, not a fake feed.

#### 2. Setup

Purpose: manage readiness and pre-game launch without interleaving active-game tools.

Visible before start; read-only archive after start.

Sections:

- GM code and player readiness summary.
- Next step card with exact blockers: GM setup, missing slots, not-ready players.
- Player Slots & Claim Codes:
  - Keep compact slot rows here.
  - Primary editor remains `/game/[gameId]/gm/realm-slots`.
  - Include copy-to-clipboard for claim codes if not already provided by the slots subroute.
- Player Setup Progress:
  - Claimed slots only.
  - Checklist completion count and missing requirements.
- Launch actions:
  - `Mark GM Setup Ready`.
  - `Start Game`, visible only when `canStartGame` is true.

#### 3. Realms & Turmoil

Purpose: create, edit, inspect, and triage realms.

Sections:

- Realm toolbar:
  - Search/filter by realm name.
  - Filter chips for Player, NPC, Unready, Warnings, Turmoil > 2, Turmoil > 5, Winter unrest.
  - `Add NPC Realm`.
- Realm roster:
  - Dense table or stacked cards depending on viewport.
  - Each row shows government, player/NPC, assigned territories, treasury, projected treasury, projected turmoil, warnings, setup state, capital status, and technical knowledge.
  - Row action opens a right-side detail panel or inline detail region keyed by `realmId`.
- Realm detail panel:
  - Profile: name, government, traditions, technical knowledge, treasury, territory assignment.
  - Capital placement: NPC only, uses existing `TerritoryHexMap` flow.
  - Turmoil: current breakdown, building reductions, add/remove manual sources.
  - Links: manage NPC realm via `/game/[gameId]/realm?realmId=...`.
- Add/edit realm form:
  - Move the current inline form into a dedicated `GmRealmEditor`.
  - The form should not push the whole page down from the top; use a modal/drawer or a clearly scoped inline panel below the toolbar.

#### 4. World & Assets

Purpose: edit territories, settlements, buildings, transfers, and GM asset overrides.

Sections:

- World filters:
  - Territory owner, neutral only, has settlements, has sea/river access.
  - Settlement search.
- Territory list:
  - Accordion/table hybrid with keyboard-accessible expand controls.
  - Summary row: territory name, owner, settlement count, food cap, sea/river access.
- Territory detail:
  - Owner assignment.
  - Territory fields: name, food cap base, food cap bonus, river access, sea access.
  - Settlement list for that territory.
- Settlement detail:
  - Edit name/size.
  - Transfer settlement, including optional parent territory transfer and warning that turmoil will be added and governor cleared.
  - Buildings: display type, size, operational state, construction turns, delete.
  - Add building as GM override with optional GOS charge source.
  - Recruit troop as GM override with optional GOS charge source.
  - Add settlement with hex selection via `TerritoryHexMap`.

#### 5. Governance & GOS

Purpose: manage political offices, noble status, GOS data, and building GOS assignments without hiding them inside realm cards.

Sections:

- Realm selector:
  - Required for per-realm governance operations.
  - Persist selected realm as `?tab=governance&realmId=...`.
- Per-realm setup data:
  - Noble families.
  - Nobles.
  - Realm GOS creation/editing.
  - Building GOS owner/allotted assignments.
  - This is the extracted `RealmManagementEditor`.
- Governance offices:
  - Heir designation.
  - Settlement governors.
  - Army generals.
  - GOS leaders.
  - Noble status/activity editing.
  - This is the extracted `GovernanceRealmPanel`.
- Global GOS directory:
  - Total count and combined treasury.
  - GOS rows with leader, monopoly product, treasury, linked realms, and manage link.
  - This is the extracted `GlobalGOSPanel`.

#### 6. Turn Operations

Purpose: active-game turn review and resolution work.

Visible when the game is active or completed.

Sections:

- Full `GmTurnReviewPanel` from `src/components/turn-actions/gm-turn-review-panel.tsx`.
- Keep turn action fetching inside the panel for the first pass, but do not also mount it in Overview.
- Add a compact empty state when there is no active turn or no submitted actions.

## Component and Route Decomposition

Keep `/game/[gameId]/gm` as the main route. Prefer component extraction plus query-param tabs over adding many nested routes in the first pass. The only existing subroute to keep is `/game/[gameId]/gm/realm-slots`.

Recommended file layout:

- `src/app/game/[gameId]/gm/page.tsx`
  - Thin route component.
  - Reads `gameId`, role, router/search params.
  - Renders `GmDashboardShell`.
- `src/components/gm/GmDashboardShell.tsx`
  - Owns tab selection, shared dashboard data, refresh orchestration, and command header actions.
- `src/components/gm/GmCommandHeader.tsx`
  - Game title, badges, primary actions, utility actions.
- `src/components/gm/GmStatusSummary.tsx`
  - Summary cards derived from shared data.
- `src/components/gm/GmTabs.tsx`
  - URL-synced accessible tabs.
  - Can wrap or replace `src/components/ui/tabs.tsx`; if replacing, keep the old component API intact for existing callers.
- `src/components/gm/setup/GmSetupTab.tsx`
- `src/components/gm/setup/GmPlayerSlotsCard.tsx`
- `src/components/gm/setup/GmPlayerSetupProgress.tsx`
- `src/components/gm/realms/GmRealmsTab.tsx`
- `src/components/gm/realms/GmRealmRoster.tsx`
- `src/components/gm/realms/GmRealmEditor.tsx`
- `src/components/gm/realms/GmRealmDetailPanel.tsx`
- `src/components/gm/realms/GmCapitalPlacement.tsx`
- `src/components/gm/realms/GmTurmoilPanel.tsx`
- `src/components/gm/world/GmWorldAssetsTab.tsx`
- `src/components/gm/world/GmTerritoryList.tsx`
- `src/components/gm/world/GmTerritoryEditor.tsx`
- `src/components/gm/world/GmSettlementEditor.tsx`
- `src/components/gm/world/GmSettlementTransferPanel.tsx`
- `src/components/gm/world/GmBuildingOverridePanel.tsx`
- `src/components/gm/world/GmTroopOverridePanel.tsx`
- `src/components/gm/governance/GmGovernanceGosTab.tsx`
- `src/components/gm/governance/GmRealmManagementEditor.tsx`
  - Extracted from current `RealmManagementEditor`.
- `src/components/gm/governance/GmGovernanceRealmPanel.tsx`
  - Extracted from current `GovernanceRealmPanel`.
- `src/components/gm/governance/GmGlobalGosPanel.tsx`
  - Extracted from current `GlobalGOSPanel`.
- `src/components/gm/forces/GmRealmTroopPanel.tsx`
  - Extracted from current `RealmTroopPanel`.
- `src/components/gm/turns/GmTurnOperationsTab.tsx`
  - Wraps `GmTurnReviewPanel`.
- `src/components/gm/hooks/useGmDashboardData.ts`
  - Shared fetch/mutation refresh helpers.
- `src/components/gm/hooks/useGmTabState.ts`
  - Reads and writes `?tab=` and optional `realmId`.
- `src/components/gm/types.ts`
  - Local view models and prop types only. Reuse DTOs from `src/types/api.ts` instead of redefining API contracts.

Implementation should move code in small slices:

1. Extract pure presentational sections from `page.tsx` without changing behavior.
2. Add URL-synced tabs and move sections into tabs.
3. Split shared dashboard fetch state from tab-specific fetch state.
4. Move nested per-realm panels into `src/components/gm/...`.
5. Add accessibility and responsive polish.
6. Remove dead state from `page.tsx` after all callers move.

## Data Fetching and Regression Avoidance

### Shared Data

`useGmDashboardData(gameId)` should load only data needed by the header, summary, Overview, Setup, Realms, and World summaries:

- `GET /api/game/:gameId`
- `GET /api/game/:gameId/realms`
- `GET /api/game/:gameId/territories`
- `GET /api/game/:gameId/player-slots`
- `GET /api/game/:gameId/economy/overview`
- `GET /api/game/:gameId/settlements`
- `GET /api/game/:gameId/map`
- `GET /api/game/:gameId/gos?all=true`

This mirrors the current `loadDashboard()` payload so the first extraction does not lose fields.

Follow current tolerant behavior:

- Failure of game, realms, territories, or player slots should show a dashboard-level error.
- Failure of optional overview, settlements, map, or all-GOS should degrade the relevant section rather than blocking the whole page, matching the current partial handling.
- Continue parsing `realm.technicalKnowledge` with `parseTechnicalKnowledge`.

### Tab-Specific Data

Avoid mounting expensive nested panels unless their tab or realm detail is active:

- Governance tab:
  - Load `noble-families`, `nobles`, and `gos` only for selected `realmId`.
  - Load governance offices only for selected `realmId`.
- Turn Operations:
  - Mount `GmTurnReviewPanel` only in the Turn Operations tab.
- Realm troop transfer:
  - Load `troops?realmId=...` only when a realm's force panel is opened.
- Global GOS:
  - Use shared `gos?all=true` data when possible. If the extracted component needs its own refresh button, it can refetch the same endpoint and then notify the shell to refresh shared GOS state.

### Refresh Strategy

Current behavior refreshes everything every 5 seconds. Preserve live-readiness behavior without forcing all hidden workflow data to refetch:

- Keep a 5-second poll for pre-start shared setup state while the Setup tab is active.
- Keep a 10-15 second poll for active Overview summaries unless the GM is editing a form.
- Do not auto-refresh while a dirty form is open in realm, world, or governance panels unless the user explicitly refreshes.
- After every mutation, call the narrowest refresh that updates the changed domain and then refresh shared summary data:
  - Realm create/edit, capital placement, turmoil add/remove: refresh realms, territories if ownership changed, economy overview if turmoil/economy can change.
  - Territory/settlement/building/troop mutation: refresh territories, settlements, all GOS if GOS charge source was used, economy overview.
  - GOS/noble/governance mutation: refresh selected governance data and shared all-GOS or realms if visible fields changed.
  - Start game/GM ready: refresh game and player slots.

### Mutation Safety

- Preserve all existing confirm dialogs or replace them with accessible confirmation dialogs before destructive actions:
  - settlement delete
  - building delete
  - settlement transfer
- Preserve settlement transfer warning text: transfer adds turmoil to losing and gaining realms and clears governor.
- Preserve `gmOverride: true` and `instant: true` on GM-created buildings and troops.
- Preserve optional `chargeGosId` behavior for GM building/troop overrides.
- Do not change endpoint request bodies while extracting components.

### Testing Expectations

- Add focused component tests for:
  - default tab selection before active vs active.
  - URL tab selection and `realmId` persistence.
  - Setup blockers and start button visibility.
  - Realm risk badges and turmoil threshold variants.
  - World transfer panel disables confirm until a target realm is selected.
  - Governance tab does not load per-realm data until a realm is selected.
- Keep existing API route tests untouched.
- Run `npm run typecheck`, `npm run lint`, and relevant `vitest` component tests after implementation.

## Accessibility Requirements

- Tabs must use `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, and keyboard support for ArrowLeft, ArrowRight, Home, End, Enter, and Space.
- The active tab must be reflected in the URL and focus should remain on the activated tab when switching via keyboard.
- Accordion rows in World must use real buttons, not clickable `div`s, with `aria-expanded` and visible focus states.
- Destructive actions must have accessible confirmation UI. If `window.confirm` remains temporarily, buttons must still have specific labels such as `Delete building Castle` or `Transfer settlement Redford`.
- Form controls must keep visible labels from `Input`/`Select` components. Checkbox labels must remain clickable.
- Error messages should be placed near the relevant form and exposed through `role="alert"` or `aria-live="polite"` for dashboard-level and form-level errors.
- Loading states should distinguish initial page load from tab-level loading. Do not replace the entire page with a loading message when a hidden tab refreshes.
- Technical knowledge, turmoil, GOS, and setup status badges must not rely on color alone; include text labels.

## Responsiveness Requirements

- The dashboard frame should be usable at mobile width without horizontal page scroll.
- Header badges and action buttons should wrap into predictable rows. Primary launch actions should appear before secondary actions on narrow screens.
- Top-level tabs should become a horizontally scrollable tablist or compact segmented control on small screens, with no clipped tab labels.
- Realm roster should render as a table on wide screens and stacked summary rows/cards on mobile.
- World territory rows should keep summary information scannable on mobile; expanded settlement tools should stack form fields vertically.
- Map placement panels using `TerritoryHexMap` should maintain a stable aspect ratio and not overflow the viewport.
- Dense GOS/governance assignment grids should collapse from multi-column grids to single-column forms below `md`.

## Acceptance Criteria

- `/game/[gameId]/gm` renders a command-center frame with header, status summary, and workflow tabs.
- Pre-start games default to the Setup tab; active/completed games default to Overview.
- `?tab=` deep links select the correct tab, and `?realmId=` opens or preselects the relevant realm where applicable.
- All current GM capabilities remain available:
  - mark GM setup ready
  - start game
  - refresh
  - map link
  - database export
  - player slots and setup progress
  - NPC realm create/edit
  - territory assignment
  - capital placement
  - technical knowledge edit
  - turmoil add/remove
  - territory edit
  - settlement add/edit/delete/transfer
  - building delete and GM add
  - troop GM recruit and transfer
  - noble family/noble/GOS creation and edit
  - heir/governor/general/GOS leader assignment
  - noble status/activity edit
  - global GOS directory
  - active turn review
- Hidden tabs do not mount their expensive nested fetch panels until selected.
- No mutation request body changes from the current implementation unless covered by existing or new tests.
- Form edits are not overwritten by background polling.
- Keyboard users can navigate tabs, accordions, and confirmation controls.
- Mobile layout has no horizontal page scroll for the core dashboard, setup, realms, world, governance, and turn tabs.
- Typecheck, lint, and targeted component tests pass.

## Risks and Open Questions

- `GmTurnReviewPanel` currently fetches its own turn, settlements, realms, queue, and nobles data. Keeping it self-contained avoids immediate regressions but may duplicate data when the Overview grows a turn summary.
- There is no existing shared data-fetching/cache layer. A custom hook is enough for this refactor, but a later roadmap item may need a broader client cache strategy.
- The current `Tabs` component is not accessible enough for this dashboard's needs. Decide whether to enhance it globally or add a GM-specific tab component to avoid changing existing pages.
- Some current panels fetch per realm on mount. Moving them into tab/detail components changes when data appears; acceptance tests should verify there is a clear loading state and no missing default data.
- The Overview risk table depends on fields currently spread across `RealmDto` and `EconomyOverviewRealmDto`. If these diverge, engineers should prefer economy overview values for projected metrics and fall back to realm fields only when overview is unavailable.
- The current page uses `window.confirm` for destructive actions. Replacing it with the dialog component is better for accessibility but increases implementation scope.
- `RealmManagementEditor` and `GovernanceRealmPanel` overlap around GOS leader assignment and noble editing. The first pass should extract both as-is, then consolidate duplicate controls only after behavior parity is proven.
