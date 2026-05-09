# Real Authenticated App Shell and Navigation

## Problem Statement

Authenticated game routes currently feel like isolated pages instead of one coherent application. `src/app/game/[gameId]/layout.tsx` renders only a thin game-name/status bar and a Rulebook link, while player and GM movement depends on repeated back links, page-local buttons, and dashboard cards. This makes context easy to lose, especially for GMs managing a player realm through `?realmId=`.

## Goals

- Introduce a persistent, premium app shell for authenticated `/game/[gameId]/*` routes that keeps game, role, phase, and current realm context visible.
- Provide role-aware primary navigation for GM, player, setup, active, and completed states.
- Make active route state obvious across top-level sections and nested realm pages.
- Add a consistent primary action area for the next likely action: continue setup, open turn report, review turns, manage slots, start game when eligible, or return to GM context.
- Standardize GM realm context switching so `?realmId=` is preserved intentionally rather than rebuilt in each page.
- Reduce page-level navigation duplication without forcing a full redesign of every game page.
- Preserve the current cookie/code authentication model and existing game routes.

## Non-Goals

- Do not introduce account-based authentication, user profiles, or cross-game account switching.
- Do not replace the existing game setup, GM dashboard, realm dashboard, map, or turn action workflows.
- Do not move all page data loading into the shell. Pages should keep fetching their domain-specific data.
- Do not change the canonical route structure for realm pages in this pass. GM-managed player views continue to use `?realmId=`.
- Do not add real-time transport. Polling or navigation-triggered refresh is acceptable.
- Do not add a new icon dependency unless the implementation team explicitly chooses to; the repo currently has no icon package.

## Current State References

- `src/app/game/[gameId]/layout.tsx`
  - Client layout fetches `/api/game/${gameId}` directly.
  - Hides nav only on `/game/${gameId}`.
  - Shows game name, current season/year, turn phase, and a Rulebook link.
  - Does not know the authenticated role, current realm, setup state, active route section, or GM-managed realm context.
- `src/hooks/use-role.ts`
  - Client hook fetches `/api/auth/session`.
  - Exposes `role`, `gameId`, `realmId`, `gamePhase`, `initState`, `gmSetupState`, `playerSetupState`, `displayName`, `territoryId`, and `claimCode`.
  - Used independently by many pages, causing each page to solve redirects and context handling locally.
- `src/lib/auth.ts`
  - Cookie session source of truth: `rulers-game-id`, `rulers-gm-code`, and `rulers-claim-code`.
  - `resolveSessionFromCookies()` already returns the role and current player slot data needed by the shell.
  - `requireOwnedRealmAccess()` already defines the important rule: players may only access their own realm, while GMs may provide a requested `realmId`.
- `src/app/api/auth/session/route.ts`
  - Thin wrapper around `resolveSessionFromCookies()`.
- `src/app/api/game/[gameId]/route.ts`
  - Returns `toPublicGame(game, role)`.
  - Includes `gmCode` only for a GM session.
- `src/app/game/[gameId]/page.tsx`
  - Public join/redirect route. It should remain shellless until a role is known.
  - Redirects authenticated GMs to `/game/[gameId]/setup` or `/game/[gameId]/gm`, and authenticated players to `/create-realm` or `/realm`.
- `src/app/game/[gameId]/realm/page.tsx`
  - Player realm dashboard and GM-managed realm view.
  - Rebuilds `isGmManaging`, `realmId`, and `realmLinkSuffix`.
  - Uses a `Back to GM Dashboard` link plus a grid of dashboard cards as primary movement.
- `src/app/game/[gameId]/realm/*`
  - `treasury`, `nobles`, `gos`, `army`, `settlements`, `trade`, `report`, and `ruler/create` repeat role/context logic and link back to `/realm`.
- `src/app/game/[gameId]/gm/page.tsx`
  - Owns GM header, game badges, setup/start controls, map/export controls, realm links, and `GmTurnReviewPanel`.
  - Polls dashboard data every five seconds.
- `src/app/game/[gameId]/gm/realm-slots/page.tsx`
  - GM-only setup route with its own back-to-dashboard affordance.
- `src/app/game/[gameId]/map/page.tsx`
  - Shared GM/player map route.
  - Computes `backHref` from role and shows "Back to dashboard" controls instead of relying on shell navigation.
- Existing UI primitives:
  - `src/components/ui/button.tsx`, `badge.tsx`, `card.tsx`, `select.tsx`, and `dialog.tsx` should be reused.
  - Global theme tokens live in `src/app/globals.css`.

## Proposed UX and IA

### Shell Structure

Use one authenticated shell for every role-aware route under `/game/[gameId]/*`, except the public join/redirect page at `/game/[gameId]`.

- Desktop:
  - Sticky top command bar containing game name, season/year, game phase, turn phase, role badge, current context, primary action, and Rulebook.
  - Persistent left navigation rail for section movement.
  - Main content area with existing page width constraints preserved.
  - A wide-content mode for `/game/[gameId]/map` so the map can use the available viewport without being visually squeezed.
- Tablet/mobile:
  - Sticky compact header with game/context summary and primary action.
  - Collapsible navigation drawer or bottom section nav with the same item set as desktop.
  - Context switcher remains reachable from the header, not buried inside page content.

The shell should feel operational, not like a marketing page: restrained parchment/ink styling, strong information hierarchy, compact status badges, and stable controls.

### Global Header Content

Header content should be consistent:

- Game identity: game name linking to the role-appropriate home route.
- Time/phase: `currentSeason`, `currentYear`, `gamePhase`, `initState` when setup is not active/completed, and `turnPhase`.
- Role identity:
  - `GM` for GM session.
  - Player display name if present, otherwise `Player`.
- Realm context:
  - Player with a realm: realm color swatch and realm name.
  - Player without a realm: `No realm yet` and a create/continue setup action.
  - GM default view: `GM View`.
  - GM managing a realm: `Managing: <realm name>` plus an explicit `Exit realm view` action to `/game/[gameId]/gm`.
- Secondary utility: Rulebook link to `/rules`.

### Primary Action Area

The shell should always reserve the right side of the header for one primary action plus optional secondary utilities. Defaults:

- Unauthenticated or unknown role: no shell.
- GM, `gm_world_setup`: `Continue World Setup` -> `/game/[gameId]/setup`.
- GM, pre-active setup with player slots not ready: `Manage Realm Slots` -> `/game/[gameId]/gm/realm-slots`.
- GM, pre-active setup and game can start: `Start Game`, calling existing `POST /api/game/[gameId]/start`, then refreshing shell state and navigating to `/game/[gameId]/gm`.
- GM, active/completed: `Review Turns` -> `/game/[gameId]/gm#turn-review`.
- GM managing a realm: `Return to GM View` -> `/game/[gameId]/gm`.
- Player without a realm: `Create Realm` -> `/game/[gameId]/create-realm`.
- Player during setup with a realm: `Continue Setup` -> `/game/[gameId]/realm`.
- Player active: `Turn Report` -> `/game/[gameId]/realm/report`.
- Player completed game: `View Realm` -> `/game/[gameId]/realm`.

Page-local actions can remain inside pages. The shell action is the global next step, not a replacement for every page button.

### Navigation Model

Build navigation from a typed config instead of hand-written page links. Active state should use `usePathname()` plus route matchers, ignoring query strings except for context labels.

Player nav:

- Realm Overview -> `/game/[gameId]/realm`
- Turn Report -> `/game/[gameId]/realm/report`
  - Show only when `gamePhase === 'Active'` or `initState === 'completed'`; otherwise disabled or omitted.
- World Map -> `/game/[gameId]/map`
- Ruler & Nobles -> `/game/[gameId]/realm/nobles`
- Settlements & Buildings -> `/game/[gameId]/realm/settlements`
- Armies & Fleets -> `/game/[gameId]/realm/army`
- Treasury -> `/game/[gameId]/realm/treasury`
- Trade & Resources -> `/game/[gameId]/realm/trade`
- Guilds, Orders & Societies -> `/game/[gameId]/realm/gos`

Player setup nav:

- Create Realm -> `/game/[gameId]/create-realm` when no `realmId`.
- Realm Setup -> `/game/[gameId]/realm` once a realm exists.
- Setup sections reuse the player nav but can mark incomplete sections later when checklist data is available.

GM nav:

- GM Dashboard -> `/game/[gameId]/gm`
- World Setup -> `/game/[gameId]/setup` when `initState === 'gm_world_setup'`
- Realm Slots -> `/game/[gameId]/gm/realm-slots`
- World Map -> `/game/[gameId]/map`
- Review Turns -> `/game/[gameId]/gm#turn-review` when active or completed
- Rulebook -> `/rules`

GM realm-management nav, shown when a GM has selected a managed realm:

- Managed Realm Overview -> `/game/[gameId]/realm?realmId=<realmId>`
- Nobles -> `/game/[gameId]/realm/nobles?realmId=<realmId>`
- Settlements -> `/game/[gameId]/realm/settlements?realmId=<realmId>`
- Armies & Fleets -> `/game/[gameId]/realm/army?realmId=<realmId>`
- Treasury -> `/game/[gameId]/realm/treasury?realmId=<realmId>`
- Trade -> `/game/[gameId]/realm/trade?realmId=<realmId>`
- Guilds, Orders & Societies -> `/game/[gameId]/realm/gos?realmId=<realmId>`
- Exit Realm View -> `/game/[gameId]/gm`

### Context Switching

Add a header context switcher:

- Player:
  - Not a dropdown unless there is a future multi-realm player use case.
  - Shows the current realm name and color when available.
  - Shows `Create Realm` state when no realm exists.
- GM:
  - Dropdown includes `GM View` and every realm available in the game.
  - Selecting `GM View` routes to `/game/[gameId]/gm`.
  - Selecting a realm routes to the nearest equivalent realm page:
    - From `/gm` or `/map`: `/game/[gameId]/realm?realmId=<newRealmId>`.
    - From `/realm/trade?realmId=old`: `/game/[gameId]/realm/trade?realmId=<newRealmId>`.
    - From `/realm/ruler/create?realmId=old`: preserve that subroute with the new query.
  - The shell must be the only code responsible for preserving `realmId` in navigation links. Page-level `realmLinkSuffix` helpers should be removed as pages are touched.

## Implementation Plan

### 1. Add a Shell DTO Endpoint

Create `src/app/api/game/[gameId]/shell/route.ts`.

Responsibilities:

- Load game by `gameId`.
- Resolve session with `resolveSessionFromCookies()`.
- Return 404 for missing game.
- Return a shell payload with `role: null` for valid game/no matching session; the client layout will skip shell on `/game/[gameId]` and let the join page render.
- Validate `session.gameId === gameId` before treating the session as authenticated.
- Accept optional `realmId` query for GM-managed context.
- Honor requested `realmId` only when the session is GM.
- For players, force `activeRealmId` to `session.realmId`.
- Return only data required for global shell decisions.

Suggested payload shape:

```ts
export interface GameShellDto {
  game: GameDto;
  session: {
    role: 'gm' | 'player' | null;
    gameId: string | null;
    realmId: string | null;
    gamePhase: GamePhase | null;
    initState: GameInitState | null;
    gmSetupState: GMSetupState | null;
    playerSetupState: PlayerSetupState | null;
    displayName: string | null;
    territoryId: string | null;
    claimCode: string | null;
  };
  activeRealmId: string | null;
  currentRealm: {
    id: string;
    name: string;
    color: string | null;
    isNPC: boolean;
  } | null;
  realms: Array<{
    id: string;
    name: string;
    color: string | null;
    isNPC: boolean;
  }>;
  setup: {
    canStartGame: boolean;
    claimedPlayerCount: number;
    readyPlayerCount: number;
    totalPlayerCount: number;
  } | null;
}
```

Notes:

- `realms` can be all realms for GM and just the player's current realm for player.
- `setup` is needed only for GM primary action decisions. Compute it from `playerSlots` and `game.gmSetupState` using the same logic currently in `src/app/game/[gameId]/gm/page.tsx`.
- Keep `gmCode` behavior aligned with `toPublicGame()`: only GM sessions receive it.

Add focused route tests for player, GM, GM with `realmId`, player attempting another `realmId`, no session, and missing game.

### 2. Add Shared Types and Navigation Config

Create:

- `src/types/shell.ts` for `GameShellDto` and shell-specific small DTOs.
- `src/lib/game-navigation.ts` for pure navigation helpers.

Navigation helper API:

```ts
export function buildGameNavigation(input: {
  gameId: string;
  pathname: string;
  role: 'gm' | 'player' | null;
  initState: GameInitState;
  gamePhase: GamePhase;
  activeRealmId: string | null;
  isGmManagingRealm: boolean;
}): {
  sections: Array<{
    id: string;
    label: string;
    items: ShellNavItem[];
  }>;
  homeHref: string;
};
```

Each `ShellNavItem` should include:

- `id`
- `label`
- `href`
- `active`
- `disabled`
- `requiresRealm`
- `description` for accessible labels/tooltips when disabled

Unit-test active matching for:

- `/realm`, `/realm/nobles`, `/realm/ruler/create`
- GM `/gm` vs `/gm/realm-slots`
- `/map`
- GM-managed realm links with `?realmId=`

### 3. Build Shell Components

Create a new component folder:

- `src/components/app-shell/game-app-shell.tsx`
- `src/components/app-shell/game-shell-header.tsx`
- `src/components/app-shell/game-shell-nav.tsx`
- `src/components/app-shell/game-context-switcher.tsx`
- `src/components/app-shell/game-primary-action.tsx`
- `src/components/app-shell/mobile-game-nav.tsx`
- Optional: `src/components/app-shell/use-game-shell.ts`

Component behavior:

- `GameAppShell` is a client component.
- It receives `gameId`, `children`, and `suppressShell` from the route layout.
- It fetches `/api/game/${gameId}/shell`, passing `realmId` from `useSearchParams()` when present.
- It refetches when `gameId`, pathname, or relevant search params change.
- It exposes a lightweight refresh callback for primary actions that mutate game state.
- It scrolls content to top on pathname changes, preserving the current behavior in `layout.tsx`.
- It renders `RulesChat` once, outside the scrollable content area but within authenticated routes as it works today.

Do not make the shell responsible for route authorization. Pages should keep their existing redirects initially. The shell provides context and movement; API routes remain the enforcement boundary.

### 4. Replace the Current Game Layout

Update only `src/app/game/[gameId]/layout.tsx` during implementation:

- Remove the current thin `<nav>`.
- Keep it as the single wrapper for `/game/[gameId]/*`.
- Compute `suppressShell` for the public join route:
  - `pathname === /game/${gameId}`
- Render children without shell while suppressed.
- Render `GameAppShell` for all other game routes.
- Preserve `RulesChat`, but move ownership into `GameAppShell` so it does not appear twice.

Use a content wrapper `<div id="main-content">` rather than adding a new `<main>` around children at first, because current pages already render `<main>`. A later cleanup can standardize page roots.

### 5. Remove Duplicated Page Navigation

After shell navigation exists, update affected pages so movement is no longer dependent on local back links:

- `src/app/game/[gameId]/realm/page.tsx`
  - Remove `Back to GM Dashboard`.
  - Remove the top-level `Map` button from the header.
  - Keep summary cards, but treat them as content shortcuts rather than the only navigation.
  - Continue supporting `isGmManaging` for data loading until route-level context is refactored.
- `src/app/game/[gameId]/realm/treasury/page.tsx`
  - Remove `nav` back link to Realm.
- `src/app/game/[gameId]/realm/nobles/page.tsx`
  - Remove back-to-realm links/buttons that duplicate shell navigation.
- `src/app/game/[gameId]/realm/gos/page.tsx`
  - Remove back-to-realm links/buttons that duplicate shell navigation.
- `src/app/game/[gameId]/realm/army/page.tsx`
  - Remove back-to-realm link.
- `src/app/game/[gameId]/realm/settlements/page.tsx`
  - Remove back-to-realm link.
- `src/app/game/[gameId]/realm/trade/page.tsx`
  - Remove back-to-realm link.
- `src/app/game/[gameId]/map/page.tsx`
  - Remove `Back to dashboard` buttons and rely on shell nav.
  - Keep error/no-map states, but use shell navigation for escape.
- `src/app/game/[gameId]/gm/page.tsx`
  - Add `id="turn-review"` to the turn review section for the shell `Review Turns` action.
  - Keep GM-specific page controls such as Refresh and Export Database.
  - Consider removing duplicated Map and Realm Slots links only after the shell equivalent is verified.
- `src/app/game/[gameId]/gm/realm-slots/page.tsx`
  - Remove `Back to Dashboard` button after shell nav is present.

This cleanup can be done incrementally, but acceptance should require that every major authenticated section is reachable through the shell without visiting the dashboard first.

### 6. Styling

Use Tailwind classes and existing theme tokens from `src/app/globals.css`.

Recommended visual treatment:

- Header: parchment surface with ink border and subtle `backdrop-blur`, similar to the existing nav but taller and denser.
- Sidebar: fixed or sticky on desktop, `w-64`, border-right, compact section labels.
- Active nav item: ink text, parchment-raised background, gold left border or inset line.
- Disabled nav item: visible but muted when the route is contextually unavailable; include an explanatory `title` and accessible description.
- Realm color: small square/circle swatch using realm `color`; fall back to parchment/ink border.
- Avoid card-in-card layouts for the shell. The shell is application chrome, not page content.

### 7. Tests and Verification

Add focused tests rather than broad snapshots:

- `src/lib/game-navigation.test.ts`
  - Role-specific item inclusion.
  - Active state matching.
  - GM realm query preservation.
  - Disabled player items when no realm exists.
- `src/app/api/game/[gameId]/shell/route.test.ts`
  - Session role handling.
  - Player realm isolation.
  - GM realm context.
  - Setup `canStartGame` computation.
- Component tests for `GameAppShell` or smaller shell components:
  - Renders player nav and primary action.
  - Renders GM nav and context switcher.
  - Context switcher builds the correct href for current route.
  - `aria-current="page"` is applied to the active item.

Manual verification:

- Player joins, creates realm, moves among realm pages without using dashboard cards.
- Player active game can reach Turn Report, Map, Treasury, Trade, Nobles, Army, Settlements, and GOS from any page.
- GM can move between Dashboard, Realm Slots, Map, and managed realm pages.
- GM switches from one managed realm to another while preserving the current realm subpage.
- Public `/game/[gameId]` still shows join/redirect UI without shell chrome.

## Data, State, and Role Handling

- Treat `resolveSessionFromCookies()` as the source of truth for role and player realm.
- The shell must never trust a client-provided `realmId` for players.
- A GM-provided `realmId` should be validated against the current game before being displayed or used for nav.
- Shell state should be small and global:
  - Game metadata and phase.
  - Session role and display identity.
  - Active realm identity.
  - Realm list only where permitted.
  - Setup counts only for GM primary action logic.
- Pages keep loading their own detailed data and keep current API authorization guards.
- On primary action mutations such as `Start Game`, refresh shell state and let affected pages refresh their own data on navigation or existing polling.
- If the shell endpoint returns `role: null` on an authenticated-only path, render a minimal loading/redirect state and let the page redirect to `/game/[gameId]` as it does today.
- For completed games, keep navigation available but make primary actions view-only.

## Accessibility and Responsiveness Requirements

- Include a skip link targeting `#main-content`.
- Use semantic landmarks:
  - `<header>` for global shell header.
  - `<nav aria-label="Game navigation">` for primary nav.
  - `<nav aria-label="Realm management navigation">` when GM realm nav is shown separately.
- Apply `aria-current="page"` to the active nav link.
- Context switcher must be keyboard-operable:
  - Native `<select>` is acceptable and preferred for the first implementation.
  - If using a custom dropdown, support focus trapping while open, Escape to close, and arrow-key movement.
- Primary action buttons must expose loading and disabled states with text, not color alone.
- All header controls need visible focus rings using the existing gold focus treatment.
- Mobile layout must not hide critical navigation behind hover behavior.
- Shell content must not overlap with page content, `RulesChat`, or mobile browser safe areas.
- The map route must remain usable on small screens; the shell should collapse rather than reducing the map to an unusable column.

## Acceptance Criteria

- `/game/[gameId]` remains shellless and still supports join/redirect behavior.
- Every authenticated `/game/[gameId]/*` route displays the persistent shell after role/session load.
- Player shell shows player-aware navigation and never exposes other realms.
- GM shell shows GM navigation and a realm context switcher.
- GM-managed realm links consistently preserve `?realmId=<activeRealmId>`.
- Active nav state is correct for overview, nested realm pages, GM dashboard, realm slots, map, setup, and turn report.
- The shell primary action changes appropriately for setup, active, completed, player, GM, and GM-managed realm states.
- Major authenticated routes are reachable from the shell without relying on page-level back links or the realm dashboard card grid.
- Existing API authorization behavior remains intact.
- `RulesChat` still appears once on authenticated game routes.
- New navigation helper, shell endpoint, and shell component tests pass with `npm test`.
- Type checking passes with `npm run typecheck`.

## Risks and Open Questions

- The current route model uses query-string realm context for GM-managed views. This spec keeps it, but a future route like `/game/[gameId]/gm/realms/[realmId]/*` would be cleaner.
- Some pages render their own `<main>` with `min-h-screen` and padding. The first shell implementation should wrap them in a `<div>` to avoid nested main landmarks, then standardize page roots later.
- GM dashboard owns setup/start readiness logic today. Moving only enough of that logic into the shell endpoint for the primary action creates duplication unless a shared helper is extracted.
- The map wants maximum horizontal space. The shell needs a wide route mode so the sidebar/header improve navigation without compromising map usability.
- Player setup checklist details currently live in `src/app/game/[gameId]/realm/page.tsx` and `/api/game/[gameId]/setup/player-checklist`. The first shell can route `Continue Setup` to `/realm`; richer per-section completion markers require adding checklist data to the shell payload or a dedicated setup progress hook.
- The repo currently has no icon library. A premium shell can be built with typography, badges, and color swatches first; iconography can be added later if the product direction warrants the dependency.
