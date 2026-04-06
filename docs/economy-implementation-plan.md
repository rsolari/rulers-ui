# Economy Implementation Plan

## Scope

This plan covers backend economy work only.

Frontend work is explicitly out of scope for this pass.

Auth and permission hardening are also out of scope for now because a separate auth update is in progress. Economy APIs should follow the current repo trust model first, then be tightened once the auth work lands.

## Goals

- Each realm can view a projected treasury, revenues, and costs during the current turn.
- The GM can view that same economic picture for every realm.
- Advancing the turn resolves the economy and updates persistent game state.
- The game stores a durable log of revenues and costs.
- Players can view past-turn economic history for their realm.
- The GM can view every realm's economic history.

## Current State

The codebase already has useful calculation modules for:

- wealth generation
- food balance
- upkeep
- trade competition
- turn progression

However, those pieces are not assembled into a single canonical economy pipeline.

Current gaps:

- Turn advancement only changes season/year and does not resolve economy.
- Current turn reports store draft financial actions, but there is no durable economic ledger.
- The current treasury view calculates approximate numbers in the client instead of consuming a canonical backend result.
- There is no per-turn economic snapshot model for historical review.
- Realm tax state is too simple to support duration-based rules like one-year levy taxation.

## Design Principles

- One canonical server-side economy calculation path.
- Projections are computed from live state plus current draft report data.
- Historical economy data is persisted only after turn resolution.
- Turn advancement must resolve economy transactionally.
- APIs should be shaped for both single-realm player views and all-realm GM views.

## Phase 1: Persistence Model

Add schema support for resolved economic history and turn-spanning economy state.

### New tables

#### `economic_snapshots`

One row per realm per resolved turn.

Suggested fields:

- `id`
- `gameId`
- `realmId`
- `year`
- `season`
- `openingTreasury`
- `totalRevenue`
- `totalCosts`
- `netChange`
- `closingTreasury`
- `taxTypeApplied`
- `summary`
- `createdAt`

`summary` can be JSON for compact resolved metadata such as food balance, shortage flags, or other derived notes.

#### `economic_entries`

Line-item ledger rows linked to a snapshot.

Suggested fields:

- `id`
- `snapshotId`
- `gameId`
- `realmId`
- `year`
- `season`
- `kind` (`revenue`, `cost`, `adjustment`)
- `category`
- `label`
- `amount`
- `settlementId`
- `buildingId`
- `troopId`
- `siegeUnitId`
- `tradeRouteId`
- `reportId`
- `metadata`
- `createdAt`

This is the durable source for turn-by-turn economic logs.

### Realm economy state additions

Add fields to support rules that span multiple seasons:

- levy expiration tracking
- consecutive food shortage seasons
- consecutive food recovery seasons
- current resolved food surplus or deficit if we want fast realm-level reads

These fields should live on `realms` unless a stronger reason emerges to move them to a separate state table.

## Phase 2: Canonical Economy Engine

Create a dedicated economy module, likely `src/lib/game-logic/economy.ts`, that composes the existing lower-level game logic into one authoritative result.

It should support two modes:

- `projectEconomyForRealm`: current-turn projection from live state plus draft report
- `resolveEconomyForRealm`: final resolved turn result used by turn advancement

### Inputs

The engine should gather, for each realm:

- realm treasury and tax state
- settlements and building occupancy
- buildings and construction status
- resource sites and industries
- trade routes and protected-product state
- troops and siege units
- nobles and prisoner state
- current turn report financial actions

### Outputs

The engine should return:

- opening treasury
- projected or resolved revenue total
- projected or resolved cost total
- net change
- closing treasury
- settlement-level wealth breakdown
- food production and need summary
- food surplus or deficit summary
- shortage and recovery state transitions
- warnings and rule effects
- ledger entries suitable for persistence or API output

### Revenue model

Compute settlement wealth from:

- resource and industry wealth
- food wealth
- trade export bonuses

Then compute realm treasury revenue from the active tax rate.

### Food model

Food should be handled as a first-class part of the same turn engine, not as a separate backend system.

The engine should compute:

- food produced per settlement from empty building slots
- total food needed from settlements and standalone fortifications
- total realm food surplus or deficit
- shortage streak progression across turns
- recovery streak progression after shortages

Food results should drive both:

- monetary effects such as food-generated wealth
- non-monetary effects such as shortage warnings and future turmoil-related state

The resolved turn result should persist food metrics so later turns can apply shortage escalation correctly.

### Cost model

Compute recurring and turn-specific costs from:

- building maintenance
- troop upkeep
- siege upkeep
- noble estate upkeep
- prisoner upkeep if applicable
- construction spending
- recruitment spending
- free-form financial report spending

### Rule handling

The first version should explicitly support:

- tribute vs levy revenue
- levy duration tracking
- food production, surplus, deficit, and shortage tracking
- trade-based wealth bonuses
- trade-based construction or recruitment surcharges where applicable

If some edge rules remain incomplete, the engine should still emit warnings so the API can surface that the value is partial.

## Phase 3: Transactional Turn Advancement

Rewrite turn advancement so economy resolution becomes part of the seasonal state transition.

### Turn advancement flow

1. Load the game and all realm-dependent economic state.
2. Load current turn reports for all realms.
3. Resolve economy for each realm using the canonical economy engine.
4. Persist `economic_snapshots`.
5. Persist `economic_entries`.
6. Update realm state:
   - treasury
   - tax state
   - food surplus or deficit state
   - shortage/recovery counters
   - turmoil-related economic sources if economy affects them
7. Update construction and recruitment timers.
8. Advance the game season/year.
9. Mark resolved reports appropriately if needed.

This should happen as one transactional unit so that economy history and current realm state cannot drift apart.

## Phase 4: API Surface

Add backend APIs for the later frontend build.

### Projection APIs

#### `GET /api/game/:gameId/economy/projection`

Returns the current realm projection using the current trust model.

Response should include:

- realm summary
- opening treasury
- projected treasury
- total revenue
- total costs
- net change
- food produced
- food needed
- food surplus or deficit
- warnings
- settlement breakdown
- projected ledger entries

#### `GET /api/game/:gameId/economy/overview`

Returns high-level projected economy summaries for all realms for the GM view.

Response should include one summary per realm:

- realm id
- realm name
- opening treasury
- projected revenue
- projected costs
- projected treasury
- food surplus or deficit
- warnings count or summary

### History APIs

#### `GET /api/game/:gameId/economy/history`

Returns past resolved snapshots and ledger entries for the current realm under the current trust model.

#### `GET /api/game/:gameId/economy/history?realmId=:realmId`

Returns the same for a specified realm, intended for the GM view later.

Support optional filtering by:

- `year`
- `season`
- pagination cursor or page size if needed

## Phase 5: Tests

Add tests in three layers.

### Unit tests

Cover the economy engine for:

- settlement wealth calculation
- tax revenue
- food production and need calculation
- food surplus and deficit handling
- upkeep aggregation
- projection with draft report actions
- levy duration changes
- food shortage progression
- ledger entry generation

### Route tests

Cover:

- projection endpoints
- overview endpoint
- history endpoints

### Turn advancement tests

Expand turn-advance tests so they verify:

- economy resolution runs
- snapshots are written
- ledger entries are written
- treasury updates correctly
- season/year still advance correctly

## Explicitly Deferred

The following work is intentionally deferred until the separate auth update is complete:

- new permission middleware
- GM/player authorization enforcement in economy routes
- cookie/role validation cleanup
- secure realm scoping for route parameters

For now, economy routes should be written so auth checks can be added later without changing response shapes.

## Recommended Implementation Order

1. Add schema changes for snapshots, entries, and realm economy state.
2. Build the canonical economy engine.
3. Rewrite turn advancement around resolved economy.
4. Add projection and history APIs.
5. Add tests across engine, routes, and turn advancement.
6. Integrate auth hardening after the separate auth branch lands.
