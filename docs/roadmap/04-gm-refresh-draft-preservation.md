# Safer GM Dashboard Refresh and Draft Preservation

## Problem Statement

The GM dashboard currently reloads broad dashboard data every 5 seconds. That keeps the page fresh, but the same `loadDashboard` path also replaces React state used by inline edit panels. When a GM is editing a realm, territory, settlement, turmoil source, capital placement, G.O.S. data, noble data, or troop movement, an auto-refresh can overwrite the visible draft, reset option lists, or make the save submit a mixture of local draft and newly fetched server state.

We need to preserve live dashboard freshness without disrupting active GM work.

## Goals

- Keep automatic dashboard freshness when the GM is reading or navigating the dashboard.
- Pause automatic polling while an inline editor has an active or dirty draft.
- Track dirty drafts explicitly enough to decide whether a refresh can apply safely.
- Show clear stale-state indicators when automatic polling is paused or a refresh was deferred.
- Provide a manual refresh path that does not silently discard unsaved input.
- Use targeted refreshes after saves and mutations so the page does not need to reload every dashboard slice after every action.
- Guard against in-flight polling races where a poll starts before editing begins but resolves after the draft becomes dirty.

## Non-Goals

- Replacing polling with WebSockets, Server-Sent Events, or a realtime store.
- Backend locking or multi-GM conflict resolution beyond avoiding local draft loss.
- Persisting unsaved drafts across full page reloads or browser restarts.
- Redesigning the entire GM dashboard layout.
- Changing existing API contracts unless an implementation discovers a specific missing timestamp or version field needed for conflict messaging.

## Current State References

- `src/app/game/[gameId]/gm/page.tsx:153` defines `loadDashboard`, which fetches game, realms, territories, player slots, economy overview, settlements, map data, and all G.O.S. records, then writes them into parent component state.
- `src/app/game/[gameId]/gm/page.tsx:225` starts a 5-second `window.setInterval` that calls `loadDashboard` whenever the role is `gm`.
- `src/app/game/[gameId]/gm/page.tsx:706` exposes a manual `Refresh` button that directly calls the same broad `loadDashboard` path.
- Parent dashboard state that can be replaced by refresh includes `game`, `realms`, `territories`, `playerSlots`, `economyOverview`, `worldSettlements`, `gameMapData`, and `gmGosList`.
- Parent draft/edit state includes `realmForm`, `editingRealmId`, `showRealmForm`, `editingTerritoryId`, `editingSettlementId`, `transferringSettlementId`, `transferTargetRealmId`, `transferTerritory`, `addingSettlement`, `turmoilForm`, `capitalPlacement`, `addingBuilding`, and `addingTroop`.
- Territory and settlement edits are especially fragile because their inputs currently mutate `territories` and `worldSettlements` directly before save. A later `loadDashboard` response can replace those arrays.
- `src/app/game/[gameId]/gm/page.tsx:1678` defines `RealmManagementEditor`, with local drafts for `newFamilyName`, `newNoble`, `editingNoble`, `newGos`, and `editingGos`. Its `refreshAfterChange` calls local `load()` and parent `onChanged()`.
- `src/app/game/[gameId]/gm/page.tsx:2279` defines `GovernanceRealmPanel`, with local `editingNoble` state and its own `load()` function.
- `src/app/game/[gameId]/gm/page.tsx:2639` defines `RealmTroopPanel`, with local `transfer` state and its own `load()` function.
- `src/app/game/[gameId]/gm/page.tsx:2792` defines `GlobalGOSPanel`, with an independent `load()` and manual refresh.
- `src/components/turn-actions/gm-turn-review-panel.tsx` already uses a local `refresh()` and a manual button rather than parent polling. It is relevant mostly as an example of a smaller refresh boundary.

## Proposed UX and Data Strategy

### Refresh states

Add explicit dashboard refresh metadata to the GM page:

- `lastDashboardRefreshAt`: last time a snapshot was successfully applied.
- `refreshingDashboard`: true while a dashboard refresh is in flight.
- `autoRefreshPaused`: true when any protected editor is active or dirty.
- `deferredRefreshAt`: set when a scheduled poll was skipped or an in-flight poll was withheld because editing started.
- `pendingRefreshReason`: optional text such as `Auto-refresh paused while editing`.
- `pendingSnapshotRef`: stores at most one fetched snapshot that arrived after a draft became protected. This snapshot should not apply automatically while dirty drafts remain.

The top toolbar should show a compact status near the existing Refresh button:

- Normal: `Updated just now` or `Updated 2 min ago`.
- In flight: `Refreshing...`.
- Paused: `Auto-refresh paused while editing`.
- Stale: `Updates available - refresh when ready`.

This text must not rely on color alone. Use existing `Badge` and `Button` components.

### Draft tracking

Introduce a small draft registry instead of scattered boolean checks. The implementation can live in `src/app/game/[gameId]/gm/page.tsx` first, or be extracted to `src/hooks/use-gm-dashboard-refresh.ts` if the page becomes too hard to test.

Suggested types:

```ts
type DashboardSlice =
  | 'game'
  | 'realms'
  | 'territories'
  | 'playerSlots'
  | 'economy'
  | 'settlements'
  | 'map'
  | 'gos';

type DraftKey =
  | `realm:${string | 'new'}`
  | `territory:${string}`
  | `settlement:${string}`
  | `settlement-transfer:${string}`
  | `settlement-new:${string}`
  | `turmoil:${string}`
  | `capital:${string}`
  | `building-new:${string}`
  | `troop-new:${string}`
  | `realm-management:${string}`
  | `governance-noble:${string}`
  | `troop-transfer:${string}`;

interface DashboardDraft {
  key: DraftKey;
  label: string;
  slices: DashboardSlice[];
  dirty: boolean;
  startedAt: number;
  lastTouchedAt: number;
}
```

The parent page should derive registered drafts from existing state:

- `showRealmForm` protects `realms`, `territories`, `economy`, and `gos`.
- `editingTerritoryId` protects `territories`, `settlements`, `map`, and `economy`.
- `editingSettlementId`, `transferringSettlementId`, and `addingSettlement` protect `settlements`, `territories`, `map`, and `economy`.
- `turmoilForm` protects `realms` and `economy`.
- `capitalPlacement` protects `realms`, `settlements`, `territories`, and `map`.
- `addingBuilding` protects `settlements`, `economy`, and `gos`.
- `addingTroop` protects `settlements` and `economy`.

Nested editors should report draft activity upward:

- Add optional `onDraftChange(draft: DashboardDraft | null)` props to `RealmManagementEditor`, `GovernanceRealmPanel`, and `RealmTroopPanel`.
- `RealmManagementEditor` should report active or dirty drafts for new family, new noble, noble edit, new G.O.S., and G.O.S. edit.
- `GovernanceRealmPanel` should report the noble profile edit draft.
- `RealmTroopPanel` should report troop transfer selection once any troop is selected or a target settlement is chosen.

Dirty state should be based on actual divergence from a baseline, not only "panel is open":

- Opening an editor creates an active protected draft.
- First field change marks it dirty.
- Cancel clears the draft and restores the editor to a clean state.
- Save clears the draft before applying a forced or targeted refresh.

For the current territory and settlement editors, stop using the canonical arrays as the only draft store. Add separate draft maps such as:

```ts
const [territoryDrafts, setTerritoryDrafts] = useState<Record<string, Partial<GameTerritoryDto>>>({});
const [settlementDrafts, setSettlementDrafts] = useState<Record<string, Partial<GameSettlementDto>>>({});
```

Render editable values from `draft ?? serverValue`, submit the merged draft, and clear that draft on save or cancel. This prevents server snapshots and unsaved inputs from sharing the same object array.

### Polling behavior

Replace the direct interval call with a guarded refresh function:

```ts
async function refreshDashboard(options: {
  reason: 'initial' | 'poll' | 'manual' | 'mutation';
  slices?: DashboardSlice[];
  force?: boolean;
}): Promise<void>
```

Expected behavior:

- Initial load always fetches and applies the full snapshot.
- Poll refresh runs every 5 seconds only when there are no active protected drafts.
- If a poll fires while drafts are active, do not fetch. Set `deferredRefreshAt` and show the paused/stale status.
- If a poll request was already in flight and a draft becomes active before the response resolves, do not apply conflicting slices. Store or discard the response and show the stale status.
- Manual refresh with no dirty drafts applies immediately.
- Manual refresh with dirty drafts must ask before discarding. The GM should be offered `Keep Editing` and `Discard Drafts and Refresh`.
- Mutation refreshes after a successful save should be forced for the affected slices, after the saved draft has been cleared.

Use refs to make the interval race-safe:

- `activeDraftsRef` or `protectedSlicesRef` should contain the latest draft state.
- `refreshGenerationRef` should increment on every refresh request so older responses cannot overwrite newer applied data.
- `draftGenerationRef` should increment when a draft becomes active, dirty, saved, or canceled. A response that began under one generation and resolves under another must re-check whether its slices are still safe.

### Applying snapshots by slice

Split `loadDashboard` into fetch and apply phases:

```ts
interface DashboardSnapshot {
  game: GameDto;
  realms: RealmDto[];
  territories: GameTerritoryDto[];
  playerSlots: PlayerSlotDto[];
  economyOverview: Record<string, EconomyOverviewRealmDto>;
  worldSettlements: GameSettlementDto[];
  gameMapData: GameMapData | null;
  gmGosList: GMDashboardGOS[];
}

async function fetchDashboardSnapshot(gameId: string): Promise<DashboardSnapshot>
function applyDashboardSnapshot(snapshot: DashboardSnapshot, slices?: DashboardSlice[]): void
```

This keeps the current `Promise.all` data loading behavior but allows safe targeted commits.

Slice mapping:

- `game`: `setGame`
- `realms`: `setRealms`
- `territories`: `setTerritories`
- `playerSlots`: `setPlayerSlots`
- `economy`: `setEconomyOverview`
- `settlements`: `setWorldSettlements`
- `map`: `setGameMapData`
- `gos`: `setGmGosList`

When `slices` is omitted, apply all slices that are not currently protected. For `force: true`, apply requested slices even if they were protected, but only after the save/cancel path has cleared the relevant draft state.

### Targeted refreshes after existing actions

Update existing handlers to call `refreshDashboard` with affected slices:

- `startGame`: `['game', 'playerSlots', 'realms', 'economy']`
- `markGMReady`: `['game', 'playerSlots']`
- `saveRealm`: clear `realmForm` draft, then refresh `['realms', 'territories', 'settlements', 'economy', 'gos']` with `force: true`
- `addTurmoilSource` and `removeTurmoilSource`: `['realms', 'economy']`
- `assignTerritory` and `saveTerritory`: `['territories', 'realms', 'settlements', 'map', 'economy']`
- `saveSettlement`, `deleteSettlement`, `transferSettlement`, and `addSettlement`: `['settlements', 'territories', 'realms', 'map', 'economy', 'gos']`
- `deleteBuilding` and `addBuildingGM`: `['settlements', 'economy', 'gos']`
- `placeCapital`: `['realms', 'settlements', 'territories', 'map']`
- `addTroopGM`: `['settlements', 'economy']`
- `RealmManagementEditor.refreshAfterChange`: keep local `load()`, then call parent `onChanged(['realms', 'settlements', 'gos', 'economy'])`
- `GovernanceRealmPanel`: keep local `load()` for assignment/profile changes. It does not need a parent refresh unless a change affects parent realm summary data.
- `RealmTroopPanel`: keep local `load()` after troop transfer. If projected economy or settlement troop counts are later shown in parent summaries, add parent `onChanged(['settlements', 'economy'])`.
- `GlobalGOSPanel`: keep its manual local refresh. Parent refresh can still update `gmGosList` used by add-building/add-troop charge options.

The implementation should avoid calling the old broad `loadDashboard` from nested save paths once targeted refresh exists.

## Implementation Plan

1. In `src/app/game/[gameId]/gm/page.tsx`, rename the current `loadDashboard` body into `fetchDashboardSnapshot` plus `applyDashboardSnapshot`.
2. Add dashboard refresh metadata state and refs: `lastDashboardRefreshAt`, `refreshingDashboard`, `deferredRefreshAt`, `pendingSnapshotRef`, `refreshGenerationRef`, and `draftGenerationRef`.
3. Add a `refreshDashboard` callback that handles initial, poll, manual, and mutation refresh modes.
4. Replace the 5-second interval effect so it calls `refreshDashboard({ reason: 'poll' })` and skips fetches when protected drafts are active.
5. Replace the manual toolbar Refresh button with a guarded refresh action. If dirty drafts exist, render an inline confirmation with `Keep Editing` and `Discard Drafts and Refresh`.
6. Add a small status element next to the Refresh button that reports updated, refreshing, paused, or stale states.
7. Add parent draft tracking for existing top-level editor state.
8. Refactor territory and settlement inline edits to use dedicated draft maps instead of mutating `territories` and `worldSettlements` as the draft source.
9. Add optional `onDraftChange` and targeted `onChanged` signatures to `RealmManagementEditor`, `GovernanceRealmPanel`, and `RealmTroopPanel`.
10. Update all existing mutation handlers to clear their draft first, then call targeted `refreshDashboard`.
11. Remove any remaining direct broad `loadDashboard` calls from save paths, except the initial load compatibility wrapper if kept during transition.
12. Add or update tests for polling, editing, manual refresh, and in-flight race conditions.

## Testing Strategy

Use Vitest and React Testing Library. Add `src/app/game/[gameId]/gm/page.test.tsx` with mocks for `next/navigation`, `next/link`, `useRole`, and `fetch`, following the existing page test patterns in `src/app/game/[gameId]/realm/army/page.test.tsx`.

Key test cases:

- Initial GM load fetches the full dashboard snapshot and renders the dashboard.
- With no active draft, advancing fake timers by 5 seconds calls the poll refresh and applies updated server data.
- While editing a realm name, advancing fake timers does not apply refreshed realm data and the input value remains the unsaved draft.
- While editing a territory, a poll response that includes a different territory name does not replace the draft input or the save payload.
- While editing a settlement, a poll response that includes a different settlement size/name does not replace the draft input or the save payload.
- In-flight race: start a poll while clean, make a draft dirty before the mocked fetch resolves, then resolve the fetch. Assert that conflicting slices are not applied and stale status appears.
- Manual refresh with a dirty draft shows the confirmation, `Keep Editing` preserves input, and `Discard Drafts and Refresh` clears draft state and applies the latest snapshot.
- Successful save clears the dirty draft before a forced targeted refresh and applies the server result.
- Targeted mutation refresh calls only the expected endpoint group or applies only the expected slices.
- The stale/paused status uses an element with accessible text and can be found by role or text in tests.

Use `vi.useFakeTimers()` for interval behavior and deferred promises for race tests. Tests should assert user-visible behavior and fetch/apply counts rather than internal hook state where possible.

Manual QA checklist:

- Open the dashboard as GM, edit a realm name, wait more than 5 seconds, and confirm the field is not overwritten.
- Repeat for territory edit, settlement edit, new settlement placement, capital placement, turmoil source, add building, add troop, Realm Management noble/G.O.S. edit, Governance noble edit, and troop transfer.
- Save each draft and confirm the relevant summary data updates without a full page flicker.
- On a narrow viewport, confirm the refresh status and buttons wrap cleanly without hiding the main action buttons.

## Accessibility and Responsiveness Requirements

- Refresh status must be text, not color only.
- Use `aria-live="polite"` on the status text so screen readers are informed when auto-refresh pauses or updates become available.
- Do not move focus when a poll is skipped or a deferred response is withheld.
- If a dirty manual refresh confirmation is rendered, focus should move to the confirmation region or the first confirmation button, and Escape or `Keep Editing` should return focus to the original Refresh button.
- Buttons must remain keyboard reachable and use clear labels: `Refresh`, `Keep Editing`, `Discard Drafts and Refresh`.
- On mobile widths, the toolbar should wrap status and buttons into multiple rows without overlapping badges or truncating critical status text.
- Stale indicators should not cover inline editors, maps, or save buttons.

## Acceptance Criteria

- Auto-refresh continues every 5 seconds while the GM has no active protected draft.
- Auto-refresh pauses while a protected editor is active or dirty.
- Unsaved inputs in realm, territory, settlement, turmoil, capital placement, add building, add troop, realm management, governance, and troop transfer flows are not overwritten by polling.
- A poll response that resolves after editing begins cannot overwrite protected slices.
- The dashboard shows when auto-refresh is paused and when data may be stale.
- Manual refresh does not discard dirty drafts without explicit confirmation.
- Saving a draft refreshes only the affected dashboard slices and applies the latest saved server state.
- Canceling or discarding a draft clears its dirty state and allows polling to resume.
- Tests cover no-draft polling, dirty-draft pause, in-flight race handling, manual refresh confirmation, and save-after-draft refresh.
- The implementation changes do not modify authorization, database schema, or unrelated dashboard behavior.

## Risks and Open Questions

- The current page is very large. Implementing this directly in `page.tsx` is possible, but extracting a small refresh/draft hook may reduce test friction and future regressions.
- Territory and settlement editors currently use canonical server arrays as draft storage. This should be fixed as part of this work; otherwise race protection will remain brittle.
- Multiple GMs can still edit the same entity concurrently. This spec prevents local draft loss, but it does not prevent last-write-wins saves. If that becomes a real workflow problem, add server `updatedAt` or revision checks later.
- Some nested panels load their own data independently. Parent polling protection will not automatically guard future nested auto-polling if it is added later; nested components should either report drafts upward or own the same pattern locally.
- A pending snapshot may be stale by the time all drafts clear. Prefer a fresh targeted refresh after saves and use pending snapshots only for clean cancel/discard flows.
