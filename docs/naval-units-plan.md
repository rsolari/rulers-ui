# Naval Units Implementation Plan

## Goal

Add naval units to the game in a way that fits the current architecture:

- naval units are ship-based military units
- ships are grouped into fleets, analogous to armies
- ship construction can require buildings and technical knowledge
- fleets can exist on water while land armies remain land-only

This plan is intentionally shaped around the current codebase, where:

- `armies` and `troops` are land-specific
- recruitment is 1-season troop recruitment, not multi-season unit construction
- the map supports water hexes, but river travel is represented as territory access plus map features, not as a navigable river hex graph
- quick combat is army-vs-army or army-vs-settlement only

## Recommended Approach

Use a parallel naval model, not a hard generalization of `armies`/`troops` in the first pass.

Why:

- current tables and services are explicitly land-oriented (`armourType`, garrison settlement rules, land hex validation, `army_general` governance wiring)
- ships need build time and water restrictions, which fit neither current troop recruitment nor siege construction cleanly
- a parallel naval path minimizes regression risk for land gameplay while still allowing shared helpers to be extracted where it helps

That means:

- keep `armies` and `troops` as land formations/units
- add `fleets` and `ships`
- extract common definition and validation helpers where practical

## Phase 0: Lock Rules Assumptions

Before implementation, make these assumptions explicit in code/docs:

- all ships are constructed at a settlement with an operational `Port`
- ship-specific requirements are additive to `Port`
- fleets are the naval equivalent of armies and may optionally have an admiral for parity with generals
- weather is stored as ship capability data now, but full weather simulation is out of scope for the first slice
- river navigation is validated from settlement/territory water access in v1, not from river-hex pathfinding

If these assumptions change, the rest of the plan still holds, but the validation rules will shift.

## Phase 1: Domain Model

### 1. Add naval types

Extend [src/types/game.ts](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/types/game.ts) with:

- `ShipType`
- `ShipClass` or `ShipWeight` with `Light | Heavy`
- `ShipQuality` with `Basic | Elite`
- `ShipCondition` for naval damage states
- `FleetTitleType` or a new noble title variant `fleet_admiral`

Recommended `ShipCondition` for v1:

- `Ready`
- `Damaged`
- `Routed`
- `Sunk`

Keep it simpler than land troop wound ladders unless naval combat immediately needs full parity.

### 2. Add ship definitions

Create `SHIP_DEFS` in [src/lib/game-logic/constants.ts](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/lib/game-logic/constants.ts) with:

- build cost
- upkeep
- build time
- weight/class
- quality
- combat bonus metadata
- required buildings
- optional technical knowledge key
- minimum weather rating
- `canUseOcean`
- `canUseCoasts`
- `canUseRivers`

Initial ship taxonomy:

| Ship | Cost | Upkeep | Class | Quality | Bonus | Build | Requirements | Weather | Ocean | Coasts | Rivers |
|---|---:|---:|---|---|---|---:|---|---|---|---|---|
| Galley | 250 | 250 | Light | Basic | +1 in Coastal Zones | 1 | Port | 5+ | No | Yes | Yes |
| War Galley | 500 | 500 | Heavy | Elite | +1 in Coastal Zones | 1 | Port, CannonFoundry | 5+ | No | Yes | No |
| Galleass | 1000 | 1000 | Heavy | Elite | +1 in Coastal Zones, +1 vs Light | 2 | Port, CannonFoundry | 5+ | No | Yes | No |
| Cog | 200 | 100 | Heavy | Basic | - | 1 | Port | 3+ | No | Yes | No |
| Holk | 1000 | 500 | Heavy | Basic | +1 vs Light | 2 | Port, PowderMill | 3+ | No | Yes | No |
| Carrack | 1500 | 750 | Heavy | Elite | +1 vs Light | 2 | Port, Shipwrights, CannonFoundry | 2+ | Yes | Yes | No |
| Galleon | 2000 | 1000 | Heavy | Elite | +2 vs Light | 3 | Port, Shipwrights, Dockyard, CannonFoundry | 2+ | Yes | Yes | No |
| Caravel | 1500 | 750 | Light | Basic | +1 in Open Seas | 2 | Port, Shipwrights, CannonFoundry | 3+ | Yes | Yes | Yes |

### 3. Add missing building definitions

Extend `BuildingType` and `BUILDING_DEFS` with:

- `Shipwrights`
- `Dockyard`
- `PowderMill`

Recommended v1 behavior:

- `Shipwrights`: unlocks advanced ocean-going hulls
- `Dockyard`: unlocks the largest capital ships
- `PowderMill`: unlocks early cannon-bearing sailing hulls

These should integrate with the existing building prerequisite and technical knowledge machinery rather than introducing a second requirements system.

## Phase 2: Persistence Layer

### 1. Add DB tables

Extend [src/db/schema.ts](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/db/schema.ts) and add a migration for:

#### `fleets`

- `id`
- `realmId`
- `gosId` nullable
- `name`
- `admiralId` nullable
- `homeSettlementId` nullable
- `locationTerritoryId`
- `locationHexId` nullable
- `destinationTerritoryId` nullable
- `destinationHexId` nullable
- `movementTurnsRemaining`
- `waterZoneType` with `river | coast | ocean`

#### `ships`

- `id`
- `realmId`
- `gosId` nullable
- `type`
- `class`
- `quality`
- `condition`
- `fleetId` nullable
- `garrisonSettlementId` nullable
- `constructionSettlementId`
- `constructionTurnsRemaining`
- `recruitmentYear` / `recruitmentSeason` or naval equivalents for reporting consistency

### 2. Extend governance relations

For parity with army generals:

- add `fleet_admiral` noble title support
- connect `fleets` into noble/governance relations

This prevents fleets from becoming a second-class military object in the UI and title system.

## Phase 3: Rules and Economy

### 1. Add ship construction validation

Mirror the current building/troop preparation model in [src/lib/rules-action-service.ts](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/lib/rules-action-service.ts):

- `prepareShipConstruction`
- `createShipConstruction`
- `prepareRealmShipConstruction`

Validation rules should cover:

- settlement exists and belongs to the realm
- settlement has an operational `Port`
- settlement/territory has appropriate water access
- required buildings are available locally or via trade
- required technical knowledge is local or traded
- target fleet and garrison assignment are mutually exclusive
- river/coast/ocean placement is legal for the ship type

### 2. Add a new financial action type

Do not overload land `recruit`.

Add a naval-specific action:

- `constructShip`

Fields:

- `shipType`
- `settlementId`
- `fleetId?`
- `technicalKnowledgeKey?`
- `description`
- `cost`

Update:

- [src/lib/financial-actions.ts](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/lib/financial-actions.ts)
- [src/lib/turn-report-financial-actions.ts](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/lib/turn-report-financial-actions.ts)
- [src/components/turn-report-financial-actions-editor.tsx](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/components/turn-report-financial-actions-editor.tsx)
- [src/lib/game-logic/economy.ts](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/lib/game-logic/economy.ts)

### 3. Charge costs correctly

Economy changes:

- build cost is charged when construction is initiated
- upkeep applies once the ship exists, even while assigned to a fleet
- foreign technical knowledge surcharge uses the same 25% model already used for buildings/troops

Important implementation detail:

the current economy engine infers technical knowledge from building prerequisites or troop recruitment. `constructShip` should carry an explicit knowledge key so ships do not have to fake troop semantics.

## Phase 4: API Surface

Add naval endpoints parallel to armies/troops:

- `GET/POST /api/game/[gameId]/fleets`
- `GET/POST/PATCH /api/game/[gameId]/ships`
- `PATCH /api/game/[gameId]/fleets/[fleetId]/admiral`

Recommended payload shape:

- fleet list returns fleets, ships, and ship construction options together
- ship creation endpoint returns derived cost, surcharge, and requirement source details, matching the existing troop/building responses

Keep armies and fleets separate at the route level in v1. If a later refactor wants a unified `/formations` endpoint, it can happen without blocking naval delivery.

## Phase 5: UI

### 1. Realm military page

Split the current army screen in [src/app/game/[gameId]/realm/army/page.tsx](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/app/game/[gameId]/realm/army/page.tsx) into two views:

- `Armies & Troops`
- `Fleets & Ships`

Or use tabs on the same page.

Naval UI needs:

- create fleet
- construct ship into fleet or harbor garrison
- show build time remaining
- show requirements and trade/knowledge surcharges
- show water capability badges: `River`, `Coast`, `Ocean`

### 2. GM tools

Extend the GM dashboard so GMs can:

- inspect all fleets
- move ships between harbor and fleet
- assign admirals
- transfer ships between realms if needed for adjudication

### 3. Realm dashboard summaries

Update [src/app/game/[gameId]/realm/page.tsx](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/app/game/[gameId]/realm/page.tsx) so total military strength includes a naval summary instead of only land troops/siege units.

## Phase 6: Map Integration

### 1. Fleet map markers

Extend [src/app/api/game/[gameId]/map/route.ts](/Users/rafael/conductor/workspaces/rulers-ui/lisbon/src/app/api/game/[gameId]/map/route.ts) and map component types to return fleets in addition to armies.

Add a dedicated fleet marker rather than reusing the army glyph.

### 2. Placement rules

Use this v1 placement model:

- sea/coastal fleets may be assigned to water hexes
- river-capable fleets may remain anchored to a port settlement or territory if there is no reliable navigable river hex representation
- if a fleet has no valid water hex anchor, show it in the territory/settlement tooltip instead of forcing a fake map position

This avoids a large river-pathfinding rewrite up front.

### 3. Later enhancement

If naval movement becomes a major gameplay loop, add a dedicated navigable-water graph:

- coastal lanes
- ocean lanes
- river lanes

That should be a separate follow-up, not a prerequisite to shipping fleets.

## Phase 7: Naval Combat

Do not force naval combat into the land quick-combat service unchanged.

Add:

- `SHIP_DEFS`-based combat dice inputs
- naval matchup bonus targets such as `Light`, `Heavy`, `CoastalZone`, `OpenSea`
- optional weather modifier input

Recommended v1 scope:

- fleet-vs-fleet quick combat
- no fleet-vs-settlement assault logic yet beyond GM adjudication

That keeps the first implementation focused and avoids inventing amphibious siege rules at the same time.

## Testing Plan

Add tests in the same style as the existing suite:

- schema/migration smoke test for `fleets` and `ships`
- rule validation tests for each ship requirement path
- economy tests for construction cost, upkeep, and technical knowledge surcharge
- API route tests for fleet and ship creation
- map route tests proving fleets appear on water-capable locations
- UI component tests for fleet tabs and ship option disabling

Critical edge cases:

- ship requires `Port` plus a traded prerequisite building
- ship requires foreign technical knowledge but not foreign buildings
- ship assigned to both fleet and harbor at creation time
- ocean-only placement rejected for ships without ocean capability
- river-only placement rejected for ships without river capability
- destroyed/sunk ships stop contributing upkeep and combat power

## What Is Out Of Scope For This Slice

Leave these out unless explicitly requested:

- embarked land-army transport
- blockade rules
- trade-route interception by fleets
- full seasonal weather generation
- river hex pathfinding
- amphibious invasions and naval bombardment

Those are meaningful systems, but they are independent of getting fleets and ships into the game cleanly.

## Delivery Order

Recommended implementation order:

1. types, constants, building defs, migration
2. naval validation service and ship construction cost logic
3. fleet/ship APIs
4. realm and GM naval UI
5. map markers
6. naval quick combat

This order gives you a usable vertical slice before tackling combat and map polish.

## Acceptance Criteria

The feature is ready when:

- a realm can construct each ship type from a valid port settlement
- construction enforces building and technical knowledge requirements
- ships can exist in harbor or inside a fleet
- fleets are visible and manageable in the realm UI and GM UI
- ship costs and upkeep appear correctly in projections/history
- fleets appear on the map without breaking army rendering
- land armies continue to work unchanged

## Follow-Up Refactor Opportunity

Once naval units are stable, consider extracting shared military primitives:

- shared formation list loading
- shared commander assignment components
- shared map overlay plumbing
- shared combat-side assembly

Do that after fleets ship, not before.
