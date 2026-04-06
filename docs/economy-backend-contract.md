# Economy Backend Contract

## Purpose

This document turns the audited economic rulebook into a machine-oriented backend contract.

It defines:

- authoritative inputs the server must trust
- derived outputs the economy engine must compute
- GM override points that require typed inputs
- missing domain fields required to make the audited rules fully enforceable
- a proposed module boundary for validation, projection, and turn resolution

This is a contract document only. It does not change current behavior.

## Contract Shape

The backend should treat economy as three separate layers:

1. `validation`: can this planned action legally happen?
2. `projection`: if current draft intent resolved now, what would the economy look like?
3. `turn resolution`: persist the final seasonal outcome and state transitions

Each layer should read the same authoritative state snapshot.

## Authoritative Inputs

These inputs should be the only persisted facts the economy engine reads directly.

### Game Frame

```ts
interface EconomyGameFrame {
  gameId: string;
  currentYear: number;
  currentSeason: Season;
}
```

Source today:

- `games.id`
- `games.currentYear`
- `games.currentSeason`

### Realm State

```ts
interface EconomyRealmState {
  realmId: string;
  name: string;
  treasury: number;
  taxType: TaxType;
  levyExpiresAt?: { year: number; season: Season } | null;
  traditions: Tradition[];
  turmoil: number;
  foodState: {
    lastResolvedSurplus: number;
    consecutiveShortageSeasons: number;
    consecutiveRecoverySeasons: number;
  };
  technicalKnowledge: TechnicalKnowledgeKey[];
}
```

Source today:

- `realms.treasury`
- `realms.taxType`
- `realms.levyExpiresYear`
- `realms.levyExpiresSeason`
- `realms.traditions`
- `realms.foodBalance`
- `realms.consecutiveFoodShortageSeasons`
- `realms.consecutiveFoodRecoverySeasons`
- `realms.turmoil`

Missing today:

- `technicalKnowledge`

### Settlement State

```ts
interface EconomySettlementState {
  settlementId: string;
  territoryId: string;
  realmId: string;
  name: string;
  size: SettlementSize;
  buildingSlotCapacity: number;
}
```

Source today:

- `settlements.id`
- `settlements.territoryId`
- `settlements.realmId`
- `settlements.name`
- `settlements.size`

Derived today:

- `buildingSlotCapacity` from `SETTLEMENT_DATA`

### Territory State

```ts
interface EconomyTerritoryState {
  territoryId: string;
  realmId: string | null;
  name: string;
  foodCapBase: number;
  foodCapBonus: number;
  hasRiverAccess: boolean;
  hasSeaAccess: boolean;
}
```

Source today:

- `territories.id`
- `territories.realmId`
- `territories.name`

Missing today:

- `foodCapBase`
- `foodCapBonus`
- `hasRiverAccess`
- `hasSeaAccess`

### Building State

```ts
interface EconomyBuildingState {
  buildingId: string;
  type: BuildingType | CustomBuildingKey;
  category: BuildingCategory;
  size: BuildingSize;
  location:
    | { kind: 'settlement'; settlementId: string; takesBuildingSlot: boolean }
    | { kind: 'territory'; territoryId: string; takesBuildingSlot: false };
  material?: FortificationMaterial | null;
  constructionTurnsRemaining: number;
  isOperational: boolean;
  maintenanceState: 'active' | 'suspended-unpaid';
  allottedGosId?: string | null;
  buildCostOverride?: number | null;
  maintenanceOverride?: number | null;
}
```

Source today:

- `buildings.id`
- `buildings.type`
- `buildings.category`
- `buildings.size`
- `buildings.material`
- `buildings.constructionTurnsRemaining`
- `buildings.isGuildOwned`
- `buildings.guildId`

Missing today:

- territory-level building location
- `takesBuildingSlot`
- `isOperational`
- `maintenanceState`
- general `allottedGosId` instead of guild-only ownership
- explicit override fields for custom/GM-managed definitions

### Resource and Industry State

```ts
interface EconomyResourceSiteState {
  resourceSiteId: string;
  territoryId: string;
  settlementId?: string | null;
  resourceType: ResourceType;
  rarity: ResourceRarity;
  industryCapacity: number;
}

interface EconomyIndustryState {
  industryId: string;
  resourceSiteId: string;
  outputProduct: ProductKey;
  quality: IndustryQuality;
  ingredientProducts: ProductKey[];
  isOperational: boolean;
}
```

Source today:

- `resource_sites.id`
- `resource_sites.territoryId`
- `resource_sites.settlementId`
- `resource_sites.resourceType`
- `resource_sites.rarity`
- `industries.id`
- `industries.resourceSiteId`
- `industries.quality`
- `industries.ingredients`

Missing today:

- `industryCapacity`
- explicit `outputProduct`
- `isOperational`

Important note:

Current load logic only keeps the first industry on a site. The contract should treat industries as a one-to-many input, not a one-to-one convenience join.

### Trade State

```ts
interface EconomyTradeAgreementState {
  tradeRouteId: string;
  realmAId: string;
  realmBId: string;
  settlementAId: string;
  settlementBId: string;
  status: 'active' | 'inactive';
  pathMode: 'land' | 'river' | 'sea' | 'mixed';
  protectedImports: ProtectedImportState[];
}

interface ProtectedImportState {
  importingRealmId: string;
  product: ProductKey;
  chosenExporterRealmId: string;
  expiresAt: { year: number; season: Season };
}
```

Source today:

- `trade_routes.id`
- `trade_routes.realm1Id`
- `trade_routes.realm2Id`
- `trade_routes.settlement1Id`
- `trade_routes.settlement2Id`
- `trade_routes.isActive`
- `trade_routes.protectedProducts`

Missing today:

- `pathMode`
- importer-scoped protected import winner state

Important note:

`productsExported1to2` and `productsExported2to1` should not be authoritative inputs in the long-term contract. They are derived outputs from product availability plus monopoly resolution.

### Planned Turn Actions

```ts
interface PlannedFinancialAction {
  actionId: string;
  type: 'build' | 'recruit' | 'spending' | 'taxChange';
  realmId: string;
  requestedCost: number;
  build?: {
    buildingType: BuildingType | CustomBuildingKey;
    location:
      | { kind: 'settlement'; settlementId: string }
      | { kind: 'territory'; territoryId: string };
    material?: FortificationMaterial | null;
    allottedGosId?: string | null;
    useImportedInputs?: boolean;
    useImportedTechnicalKnowledge?: boolean;
  };
  recruit?: {
    troopType?: TroopType;
    siegeUnitType?: SiegeUnitType;
    garrisonSettlementId?: string | null;
    useImportedInputs?: boolean;
    useImportedTechnicalKnowledge?: boolean;
  };
  spending?: {
    category: string;
    description: string;
  };
  taxChange?: {
    taxType: TaxType;
  };
}
```

Source today:

- `turn_reports.financialActions`

Missing today:

- build material
- territory-level location
- allotted GOS target
- imported-input flags
- technical-knowledge flags
- typed siege recruitment/build payloads

### External Non-Economy Inputs

Some audited rules depend on data that should remain outside the economy module but be loaded into its snapshot:

```ts
interface EconomyExternalInputs {
  realmRelations: Array<{
    realmId: string;
    otherRealmId: string;
    tradePreferenceScore: number;
  }>;
}
```

Why this matters:

- trade tie-breakers require relationship ordering
- route legality may depend on map traversal rules

## Derived Outputs

These values should be computed, never hand-authored.

### Validation Outputs

```ts
interface EconomyValidationResult {
  actionId: string;
  isValid: boolean;
  errors: EconomyRuleError[];
  warnings: EconomyRuleWarning[];
  effectiveCost: number;
  consumedInputs: ConsumedEconomicInput[];
  prerequisiteSources: PrerequisiteSource[];
}
```

Validation must answer:

- whether the action is legal under building/resource/trade rules
- whether imported resources or technical knowledge are being used
- whether the +25% surcharge applies
- whether slot limits and location rules are respected
- whether a GM override was required

### Projection Outputs

```ts
interface EconomyProjection {
  realmId: string;
  openingTreasury: number;
  projectedTreasury: number;
  totalRevenue: number;
  totalCosts: number;
  netChange: number;
  tax: {
    current: TaxType;
    appliedThisTurn: TaxType;
    nextTurn: TaxType;
    levyExpiresAt?: { year: number; season: Season } | null;
  };
  food: {
    producedBySettlement: Record<string, number>;
    producedByTerritory: Record<string, number>;
    bonusesByTerritory: Record<string, number>;
    neededBySettlement: Record<string, number>;
    neededByFortification: Record<string, number>;
    totalProduced: number;
    totalNeeded: number;
    surplus: number;
    shortageStage: 0 | 1 | 2 | 3;
    recoveryStage: 0 | 1 | 2;
  };
  settlements: SettlementEconomyProjection[];
  products: ProductProjection[];
  trade: TradeProjection[];
  ledgerEntries: EconomyLedgerEntry[];
  warnings: EconomyRuleWarning[];
}
```

Projection is where the current codebase is strongest already. It should remain pure and side-effect free.

### Resolution Outputs

```ts
interface EconomyResolution {
  realmId: string;
  snapshot: ResolvedEconomySnapshot;
  ledgerEntries: EconomyLedgerEntry[];
  statePatch: {
    treasury: number;
    taxType: TaxType;
    levyExpiresYear: number | null;
    levyExpiresSeason: Season | null;
    foodBalance: number;
    consecutiveFoodShortageSeasons: number;
    consecutiveFoodRecoverySeasons: number;
    turmoilDelta: number;
    turmoilSourceAdds: TurmoilSourceDraft[];
    turmoilSourceRemovals: string[];
  };
  constructionUpdates: ConstructionPatch[];
  tradeUpdates: TradePatch[];
  reportUpdates: ReportPatch[];
}
```

Resolution must own:

- food shortage escalation
- recovery clearing after two stable seasons
- levy expiry after the marked turn
- protected-import expiry/refresh
- operational suspension or reactivation due to unpaid maintenance

## GM Override Points

Free-form `gmNotes` are not enough for the audited rules. The backend needs typed override inputs so projections and resolution stay reproducible.

### Proposed override record

```ts
interface GMEconomyOverride {
  overrideId: string;
  gameId: string;
  year: number;
  season: Season;
  realmId?: string | null;
  kind:
    | 'force-product-winner'
    | 'allow-illegal-build-location'
    | 'allow-custom-building'
    | 'set-food-bonus'
    | 'set-food-cap'
    | 'waive-prerequisite'
    | 'waive-import-surcharge'
    | 'apply-economic-adjustment'
    | 'set-maintenance-suspension'
    | 'grant-technical-knowledge';
  payload: Record<string, unknown>;
  reason: string;
}
```

### Override situations from the audited rules

| Override point | Why it exists |
| --- | --- |
| Product winner tie-break | Rulebook defers equal quality/equal price cases to the N.O. |
| Free-standing fortification placement | Rulebook allows N.O. discretion for walls, watchtowers, monasteries-like locations |
| Custom buildings | Rulebook explicitly allows GM-authored buildings |
| Food cap bonuses | Buildings or special actions can push a territory beyond 30 |
| Technical knowledge grants | Rulebook allows events to grant knowledge |
| Imported surcharge waivers | GM may need to waive or force the 25% external-expert premium |
| Building operation suspension/reactivation | Needed when unpaid maintenance should disable an effect |
| Direct economic adjustment | Needed for narrative events, raids, gifts, embargoes, and rulings not otherwise modeled |

## Missing Domain Fields

These are the concrete fields or entities missing from the current domain model.

### Realms

- `technicalKnowledge json`
- `borrowedAmount integer`
- `loanRepaymentPerSeason integer`
- `loanRepaymentSeasonsRemaining integer`

### Territories

- `foodCapBase integer`
- `foodCapBonus integer`
- `hasRiverAccess boolean`
- `hasSeaAccess boolean`

### Buildings

- `territoryId nullable text`
- `locationType text`
- `takesBuildingSlot boolean`
- `isOperational boolean`
- `maintenanceState text`
- `allottedGosId nullable text`
- `customDefinitionId nullable text`

### Resource Sites

- `industryCapacity integer`

### Industries

- `outputProduct text`
- `isOperational boolean`

### Trade Agreements

- `pathMode text`
- `importSelectionState json`

### Turn Actions / Reports

- structured action payloads for:
  - `build.material`
  - `build.location`
  - `build.allottedGosId`
  - `build.useImportedInputs`
  - `build.useImportedTechnicalKnowledge`
  - `recruit.siegeUnitType`
  - `recruit.useImportedInputs`
  - `recruit.useImportedTechnicalKnowledge`

### New tables or JSON entities

- `gm_economy_overrides`
- `custom_building_definitions`
- `realm_relations` or another source for trade tie-break preference

## Proposed Module Boundary

The backend should split the current economy path into four small modules under one orchestration layer.

### 1. `economy/state-loader.ts`

Responsibility:

- read authoritative DB state
- normalize JSON fields
- build the immutable `EconomyStateSnapshot`

Must not:

- apply rules
- derive exports/import winners
- mutate persistence

### 2. `economy/validation.ts`

Responsibility:

- validate planned build/recruit/tax/spending actions
- resolve prerequisites from local resources, imported resources, and technical knowledge
- apply imported-resource and imported-knowledge surcharges
- enforce slot/location/material rules
- consult GM overrides when present

Primary API:

```ts
validateEconomyActions(snapshot, plannedActions, overrides): EconomyValidationResult[]
```

### 3. `economy/projection.ts`

Responsibility:

- compute per-settlement wealth
- compute per-territory and per-realm food balance
- derive product availability and monopoly winners
- derive warnings and draft ledger entries
- return player/GM-facing projections without side effects

Primary API:

```ts
projectRealmEconomy(snapshot, realmId, validatedActions, overrides): EconomyProjection
projectGameEconomy(snapshot, validatedActions, overrides): EconomyProjection[]
```

### 4. `economy/resolution.ts`

Responsibility:

- convert validated projection into a resolved seasonal outcome
- calculate food-shortage turmoil deltas
- expire levy and protected imports
- emit state patches, snapshot rows, and ledger entries
- never talk to HTTP directly

Primary API:

```ts
resolveRealmEconomy(snapshot, realmId, validatedActions, overrides): EconomyResolution
resolveGameEconomy(snapshot, validatedActionsByRealm, overrides): EconomyResolution[]
```

### 5. `economy/persistence.ts`

Responsibility:

- transact `economic_snapshots`
- transact `economic_entries`
- apply realm/building/trade/report patches
- advance season/year only after all realm resolutions are prepared

Primary API:

```ts
persistResolvedEconomy(tx, snapshot, resolutions): void
```

## Route Boundary

Existing routes can stay thin wrappers around the module boundary:

- `GET /economy/projection`
  - load snapshot
  - validate current draft actions
  - return `EconomyProjection`
- `GET /economy/overview`
  - load snapshot
  - validate all draft actions
  - return all realm projections
- `POST /turn/advance`
  - load snapshot
  - validate all submitted actions
  - resolve all realms
  - persist atomically

## Immediate Refactor Guidance

No behavior change is required to adopt this contract document.

The first safe refactors, when implementation starts, should be:

1. move action legality checks out of routes and into a dedicated validation module
2. stop treating `productsExported1to2` and `productsExported2to1` as long-term authoritative inputs
3. model fortification location/slot semantics before expanding building coverage
