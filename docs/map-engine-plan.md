# Map Engine Plan

## Scope

This plan covers backend and persistence work for adding fixed, hardcoded world maps to the game engine.

Frontend map rendering, map editing tools, and procedural map generation are explicitly out of scope for this pass.

## Goals

- Represent a world map as a hex grid.
- Support water hexes and land hexes.
- Distinguish sea water from lake water.
- Attach a terrain type to each land hex.
- Support additional land-hex features such as rivers and volcanoes.
- Allow the GM to add arbitrary landmarks to named hexes.
- Assign each land hex to a territory.
- Place settlements and fortifications on land hexes.
- Place armies on land hexes each turn.
- Load a limited set of curated maps from hardcoded assets, starting with the attached world map.

## Current State

The engine is currently territory-centric:

- `territories` are the top-level world partition and the main location primitive.
- settlements, resources, and many setup flows attach directly to `territoryId`
- armies and noble locations are tracked at territory granularity
- territory navigation is simplified to booleans like river access and sea access
- there is a simple random map generator, but it only rolls resources and settlement packages for territories

This model is workable for economy and setup, but it is too coarse for hex-level movement, terrain, landmarks, and fixed curated maps.

## Design Principles

- Keep `territory` as the political and economic grouping.
- Add `map` and `hex` as geographic layers underneath territories.
- Do not replace the economy model all at once. Add hex support first, then migrate location-bearing entities incrementally.
- Treat curated map data as source-controlled assets, not user-generated content.
- Keep the first implementation friendly to one or two known maps rather than solving for a map editor.

## Proposed Domain Model

### Core distinction

- `MapDefinition`: a curated world map asset available to a game
- `GameMap`: the selected map instance attached to one game
- `Hex`: one tile on the map, addressed by stable axial coordinates
- `Territory`: a political/economic region made up of many land hexes

### Coordinates

Use axial hex coordinates:

- `q`: column
- `r`: row

Reasons:

- simple neighbor math
- stable IDs for importing hardcoded maps
- easier pathfinding and adjacency queries than pixel-space storage

Store a derived string key such as `q:r` for deterministic import and lookup.

### Hex typing

Represent hexes as a discriminated union in TypeScript:

- `WaterHex`
  - `waterKind`: `sea | lake`
- `LandHex`
  - `terrainType`
  - `territoryId`
  - `features`

Suggested terrain vocabulary for v1:

- `plains`
- `forest`
- `hills`
- `mountains`
- `desert`
- `swamp`
- `jungle`
- `tundra`

This should stay intentionally small and be driven by the curated maps we actually ship. If the attached map needs fewer terrain types, the initial enum should be trimmed to match.

### Features

Use a small, extensible feature model instead of baking everything into terrain:

- `river`
- `volcano`
- `coast`
- `reef`
- `ford`

For v1, store features as hex-scoped data:

- `featureType`
- optional `name`
- optional `metadata`

This keeps ingestion simple. If river directionality or edge-specific movement rules become necessary later, add a second layer for edge features without changing the basic hex model.

### Landmarks

Landmarks should be GM-authored records attached to a land hex, not encoded as terrain or core features.

Suggested fields:

- `id`
- `gameId`
- `hexId`
- `name`
- `kind`
- `description`
- `createdBy`

Examples:

- named ruins
- sacred grove
- haunted battlefield
- wizard tower

### Placement model

Every game object that needs a world location should move toward `hexId` as the canonical map location.

For the first pass:

- settlements: add `hexId` and keep `territoryId`
- fortifications/buildings outside settlements: add `hexId`
- armies: add `locationHexId` and `destinationHexId`
- nobles: optionally add `locationHexId`, but this can trail armies if noble movement is still territory-level

`territoryId` should remain on settlements and resource sites because economy and ownership still aggregate by territory.

## Persistence Plan

### New tables

#### `game_maps`

One selected map per game.

Suggested fields:

- `id`
- `gameId`
- `mapKey`
- `name`
- `version`

#### `map_hexes`

One row per hex in the selected game map.

Suggested fields:

- `id`
- `gameMapId`
- `q`
- `r`
- `hexKind` (`land | water`)
- `waterKind` nullable (`sea | lake`)
- `terrainType` nullable
- `territoryId` nullable

Add a unique index on `gameMapId, q, r`.

#### `map_hex_features`

Suggested fields:

- `id`
- `hexId`
- `featureType`
- `name`
- `metadata` JSON

#### `map_landmarks`

Suggested fields:

- `id`
- `gameId`
- `hexId`
- `name`
- `kind`
- `description`
- `createdAt`

### Schema updates to existing tables

- `settlements`: add `hex_id`
- `armies`: replace or supplement `location_territory_id` and `destination_territory_id` with `location_hex_id` and `destination_hex_id`
- `buildings`: add `hex_id` for standalone fortifications and other out-of-settlement structures
- `nobles`: eventually add `location_hex_id`

### Migration strategy

Do this in stages:

1. Add new map tables and nullable `hex_id` columns.
2. Backfill `hex_id` only for games created with curated maps.
3. Keep old territory location fields temporarily so current screens and rules continue working.
4. Move rule services and APIs to read hex location first and territory location second.
5. Remove old territory-only location fields after the engine no longer depends on them.

## Curated Map Asset Format

Do not store the source map as a PNG-derived runtime artifact. Store an explicit data file per supported map.

Suggested location:

- `src/lib/maps/definitions/<map-key>.ts`

Suggested shape:

```ts
export interface CuratedMapDefinition {
  key: string;
  name: string;
  territories: Array<{
    key: string;
    name: string;
    climate?: string;
    description?: string;
  }>;
  hexes: Array<{
    q: number;
    r: number;
    kind: 'land' | 'water';
    waterKind?: 'sea' | 'lake';
    terrainType?: MapTerrainType;
    territoryKey?: string;
    features?: Array<{ type: MapFeatureType; name?: string; metadata?: Record<string, unknown> }>;
  }>;
  suggestedStarts?: Array<{
    territoryKey: string;
    hex: { q: number; r: number };
  }>;
}
```

This keeps the import deterministic and reviewable in git.

The attached image should be treated as reference art only. The actual playable map should be encoded manually in one of these curated definition files.

## Engine Layer Changes

### New map module

Create a dedicated module, likely `src/lib/game-logic/maps.ts`, responsible for:

- loading curated map definitions
- validating imported map data
- importing a curated map into DB rows
- looking up hex neighbors
- finding reachable adjacent hexes
- deriving a territory from a hex

### Validation rules

Import validation should reject:

- land hexes without `terrainType`
- land hexes without `territoryId`
- water hexes with `terrainType`
- settlements placed on water
- armies placed on water
- standalone fortifications placed on water
- landmarks placed on missing hexes

### Pathfinding and movement

Do not implement full movement costs in the first import pass, but shape the model so it is possible.

Needed later:

- hex adjacency queries
- terrain movement costs
- river and coast modifiers
- water crossing rules
- path validation for army moves

The important design choice now is that movement should become hex-to-hex, not territory-to-territory.

## Setup Flow Changes

Replace the current random territory map flow only where necessary.

### New setup approach

1. GM chooses one curated map key during world setup.
2. Backend imports territories and hexes from the curated definition.
3. Existing territory setup logic continues to create player slots, realms, settlements, and resources.
4. Starting settlements and armies are placed on specific land hexes from curated map defaults.

### Resource placement

Short term:

- keep resources attached to `territoryId`
- optionally add `hexId` later if resource-site geography becomes important

This avoids dragging economy changes into the first map pass.

## Recommended Phase Breakdown

## Phase 1: Foundational map model

- add map-related types
- add DB tables for maps, hexes, features, and landmarks
- add nullable `hexId` columns to settlements, armies, and buildings
- add import utilities for curated definitions
- add unit tests for hex validation and import

## Phase 2: Curated map ingestion

- encode the attached world map as a curated definition
- update GM setup to select and import that definition
- create territories from the curated definition instead of ad hoc setup payloads
- seed starting placements with explicit hex IDs

## Phase 3: Location migration

- update settlement APIs to return `hexId`
- update army APIs and services to use `locationHexId`
- add helper functions to derive `territoryId` from a settlement or army hex when needed
- keep territory-level compatibility until consumers are migrated

## Phase 4: Rule-service integration

- move trade-route and movement checks away from `hasRiverAccess` and `hasSeaAccess`
- replace them with map-derived facts from nearby hexes and features
- add hex-based validation for building forts, castles, and landmarks

## Phase 5: Cleanup

- remove the random territory-only generator from setup
- delete obsolete territory access booleans if fully superseded
- remove legacy territory-only location fields

## Key Decisions

### Keep territories

Territories should remain first-class because the rules and economy are organized around them. Hexes explain where things are. Territories explain who controls land and how economic aggregation works.

### Hardcoded maps, not generated maps

The right import format is explicit data checked into the repo. It is easier to validate, easier to review, and aligned with the current scope.

### Hex first, rendering later

Even without frontend rendering, the engine should store enough information to answer:

- what hex is this army on
- what terrain is that hex
- which territory owns that land
- what landmarks and features are there

That gets the backend model right before UI work begins.

## Open Questions

- Which exact terrain categories are needed for the first supported map
- Whether rivers need edge-level geometry immediately or can remain hex-scoped for one release
- Whether resource sites should get `hexId` in phase 1 or wait until movement and discovery systems need it
- Whether neutral water should ever belong to a territory, or remain always unowned

## Recommended First Slice

If the goal is the smallest valuable implementation, build this slice first:

1. Add `game_maps`, `map_hexes`, `map_hex_features`, and `map_landmarks`.
2. Add `hexId` to settlements and armies.
3. Hardcode one curated map definition for the attached world map.
4. Import the map during GM setup.
5. Require settlements and armies to be placed on land hexes.
6. Leave resource sites and most economy systems territory-based for now.

That delivers a real hex map model without forcing a full rewrite of economy, trade, or UI in the same change.
