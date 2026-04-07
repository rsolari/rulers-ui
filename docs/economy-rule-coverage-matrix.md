# Economy Rule Coverage Matrix

## Scope

Audited rule sources:

- `rules/20-food-for-the-people.md`
- `rules/24-resources-and-industries.md`
- `rules/25-trade.md`
- `rules/26-buildings.md`

Audited backend sources:

- `src/db/schema.ts`
- `src/lib/game-logic/constants.ts`
- `src/lib/game-logic/food.ts`
- `src/lib/game-logic/wealth.ts`
- `src/lib/game-logic/trade.ts`
- `src/lib/game-logic/economy.ts`
- `src/lib/economy-service.ts`
- `src/app/api/game/[gameId]/resources/route.ts`
- `src/app/api/game/[gameId]/trade-routes/route.ts`
- `src/app/api/game/[gameId]/buildings/route.ts`
- `src/app/api/game/[gameId]/economy/projection/route.ts`
- `src/app/api/game/[gameId]/economy/overview/route.ts`
- `src/app/api/game/[gameId]/turn/advance/route.ts`

Status legend:

- `implemented`: rule is materially represented in the canonical economy path.
- `partial`: some mechanics exist, but contract coverage is incomplete or lossy.
- `missing`: no trustworthy backend representation yet.

## Food for the People

| Rule area | Rulebook requirement | Current backend coverage | Status | Contract note |
| --- | --- | --- | --- | --- |
| Food production | 1 food per empty building slot | `calculateFoodProduced()` and `calculateRealmEconomy()` compute this from settlement slots minus building count | `implemented` | Keep as a derived value, not a stored field |
| Food wealth | 2,000g per food produced | `calculateFoodWealth()` applies this directly | `implemented` | Derived from produced food |
| Settlement food need | Village 1, Town 2, City 4 | `SETTLEMENT_DATA` and `calculateFoodNeeded()` encode this | `implemented` | Derived from settlement size |
| Fortification food need | Fort 1, Castle 2 | `calculateFortificationFoodNeed()` adds this for completed settlement buildings of type `Fort`/`Castle` | `partial` | Free-standing forts/castles are not representable because `buildings.settlementId` is required |
| Territory food cap | Territory produces at most 30 food before bonuses | `calculateTerritoryFoodProduced()` exists, but `calculateRealmEconomy()` never applies territory aggregation or capping | `missing` | Needs territory-level production framing and bonus sources |
| Food shortage tracking | First shortage season has no immediate mechanical effect | Warning is emitted when `foodSurplus < 0` | `partial` | Shortage state is tracked, but only as warnings/counters |
| Turmoil escalation from shortage | Second shortage season adds +1/4 current turmoil, later seasons +1/2 | `realms` has `turmoil`, but economy resolution does not mutate it from food shortage | `missing` | Needs typed resolution output into turmoil system |
| Recovery after shortage | Shortage penalties persist until 2 seasons of sufficient food | `consecutiveFoodShortageSeasons` and `consecutiveFoodRecoverySeasons` are updated | `partial` | Recovery counters exist, but penalty removal is not connected to turmoil sources |

## Resources and Industries

| Rule area | Rulebook requirement | Current backend coverage | Status | Contract note |
| --- | --- | --- | --- | --- |
| Resource rarity | Common = 10,000g, Luxury = 15,000g | `RESOURCE_BASE_WEALTH` and `calculateResourceWealth()` encode these baselines | `implemented` | Wealth remains derived |
| Food treated as economic output | Food contributes to wealth separately from industries | Settlement wealth includes food wealth and resource wealth | `implemented` | No change needed |
| Luxury dependencies | Lacquer needs Timber, Jewels need Gold/Lacquer/Porcelain, missing dependency halves value | Canonical product resolution checks dependencies for base products and luxury ingredients | `implemented` | Invalid luxury ingredients now downgrade to a base product with an explicit warning |
| Resource combinations | Luxury ingredients increase product value | Canonical product resolution validates combinations and computes wealth/quality from the same product model | `implemented` | Shared resolver now owns legality, degradation, wealth, and quality |
| Ingredient limit | No product can have more than 3 ingredients | Canonical product resolution rejects recipes above the cap instead of truncating them | `implemented` | Projection currently falls back to the base product and records a warning for invalid persisted data |
| Common resource combination matrix | Ore/Timber/Clay/Stone each allow only certain luxury add-ons | Canonical product resolution enforces the rulebook matrix | `implemented` | Applies during both wealth projection and trade-quality resolution |
| High Quality | High Quality affects trade quality ordering | `IndustryQuality` and `calculateQualityTier()` support this | `implemented` | Keep as part of product projection |
| Resource abundance | Common resources support more industries than luxury resources | Schema allows many industries per site, but economy load path keeps only the first industry per site | `missing` | Needs explicit capacity/yield model instead of implicit one-site-one-industry |
| Resource availability through trade | Imported resources count for dependency/build/recruit checks | Imported products are merged into `availableProducts` for dependency checks only | `partial` | Build/recruit validation still ignores trade-backed materials |

Ambiguity note:

- `rules/24-resources-and-industries.md` says a product can have no more than 3 ingredients, while `rules/25-trade.md` defines quality tiers up to `+3 ingredients`. The canonical resolver currently interprets the persisted `industry.ingredients` list as up to 3 additional luxury ingredients so the trade quality table remains representable. If the rules should instead cap total ingredients including the base material, the data model will need a follow-up change.
- `rules/24-resources-and-industries.md` explicitly lists which luxuries can combine with each common resource, but it does not provide a full luxury-to-luxury matrix. The canonical resolver currently allows any luxury ingredient on a luxury resource that can act as a base material, while still enforcing dependency rules like `Jewels` needing `Gold`, `Lacquer`, or `Porcelain`.

## Trade

| Rule area | Rulebook requirement | Current backend coverage | Status | Contract note |
| --- | --- | --- | --- | --- |
| Trade agreement | Trade is an agreement between two realms with one settlement endpoint each | `trade_routes` stores realm and settlement endpoints | `implemented` | Route endpoints are authoritative |
| Auto-import of missing goods | All goods a realm lacks are imported automatically | Game-level trade resolution derives import winners from realm production and active routes; persisted route exports are now cache/state output only | `implemented` | `importSelectionState` is the authoritative persisted winner state for future protections and tie stability |
| Export bonus | Exporting settlement gains +5% wealth per exported product | `calculateTradeWealthBonus()` applies 5% per exported product | `implemented` | Current bonus is correct |
| Mercantile tradition | Trade wealth bonus increases for mercantile realms | `calculateTradeWealthBonus()` adds `MERCANTILE_TRADE_BONUS` | `implemented` | Derived from traditions |
| Imported resource availability | Imported resources can satisfy building/recruit/special-action requirements | Rule validation resolves local vs traded resource access for building and recruitment prerequisites, including Brick Maker's stone substitution | `partial` | Building/recruit coverage exists; special-action consumption still needs its own contract |
| Monopoly resolution | Realm imports only one source for a product | Canonical trade resolution chooses one winner per importer/product across all active routes | `implemented` | Shared resolver now owns route-level exports/imports |
| Quality ordering | Basic/HQ/+ingredients ordering decides winner | Canonical trade resolution consumes the shared product quality tier | `implemented` | Same resolver now feeds both trade competition and economy projection |
| Price ordering | Lowest tax wins when quality ties | Canonical trade resolution uses realm tax rate as the second ordering key | `implemented` | Applied after quality comparison during winner selection |
| Relationship tie-break | Best relationship wins when quality and price tie | Canonical trade resolution surfaces unresolved ties and accepts a GM tie-break hook; no relationship model exists yet | `partial` | Needs a relation source before this can be fully automatic |
| Two-season protection | New imported product is protected for 2 seasons | Canonical trade resolution persists prior winners in `importSelectionState` and applies protection windows when a winner changes | `implemented` | Route-level `protectedProducts` is now a derived cache for display/history |
| Port requirement for water trade | Ports are required when route crosses water | Trade-route validation requires a `Port` at both endpoint settlements for non-land paths, but does not validate the world map/topology itself | `partial` | Path metadata still needs terrain/water verification |

## Buildings

| Rule area | Rulebook requirement | Current backend coverage | Status | Contract note |
| --- | --- | --- | --- | --- |
| Size/build time/cost/maintenance | All buildings use the common size tables | `BUILDING_SIZE_DATA` covers the size table | `implemented` | Canonical for generic economics |
| Construction state | Building effect is inactive while under construction | `constructionTurnsRemaining > 0` suppresses upkeep-triggered effects in economy | `partial` | Construction costs are report-driven, not consistently derived from definitions |
| Maintenance suspension | Unpaid maintenance disables building effect | Resolution suspends unpaid buildings and persists `maintenanceState` / `isOperational` accordingly | `implemented` | Allocation order is still deterministic engine policy because the rulebook does not define a priority |
| Building slots | Normal buildings consume 1 slot | Settlement slots come from `SETTLEMENT_DATA`, and occupied count respects `takesBuildingSlot` | `implemented` | Canonical slot consumption now lives in rule validation and economy projection |
| Slot exceptions | Gatehouse/Walls/Watchtower do not consume settlement slots | `takesBuildingSlot` exists and settlement-aware validation/projection respects it | `implemented` | Slotless fortifications no longer suppress food production |
| Free-standing fortifications | Fort/Castle/Walls/Watchtower may exist outside settlements | Buildings support `territoryId`/`locationType`, and normal building/settlement reads surface territory-level fortifications | `implemented` | The model is territory-level rather than free-form world coordinates |
| Material-sensitive fortifications | Timber/Stone changes fortification characteristics | `buildings.material` exists | `partial` | Material is stored but not validated against building type or used beyond carry-through |
| Bank allotment | Bank must be allotted to a Guild and enables annual borrowing | `isGuildOwned`/`guildId` exist, but loan state and annual borrowing limits do not | `partial` | Needs loan state, borrowing schedule, and ownership validation |
| Academy/College/University | Allotted to a Society; provides Society income | GOS income is stored on the GOS record, not derived from buildings | `partial` | Needs explicit `allottedGosId` and derived income contribution |
| Chapel/Church/Cathedral | Allotted to an Order; provides Order income | Same as above | `partial` | Same contract gap as Society buildings |
| Coliseum/Theatre | Modify turmoil and unlock events | Some turmoil values are hard-coded in `BUILDING_DEFS`, but not resolved through turmoil state | `partial` | Event unlocks and ongoing turmoil effects need a separate rule surface |
| Port | Enables water trade traversal | Trade-route validation checks for `Port` on non-land routes | `partial` | Still depends on route/path topology data for full enforcement |
| Brick Maker's | Clay can substitute for Stone | Rule validation resolves Clay + Brick Maker's as satisfying Stone prerequisites | `implemented` | Applies to both local and traded access checks |
| Bowyer/Weaponsmith/Armoursmith/Stables | Unlock recruitment options | Troop definitions reference required buildings | `implemented` | This should stay in validation, not economy projection |
| Stables food requirement | Stables require Food | Rule validation now requires the realm to have current food production available under territory caps before Stables can be built | `implemented` | Food is still derived state, not a separately persisted spendable input |
| Gunsmith/Cannon Foundry technical knowledge | Requires Ore and Technical Knowledge | Validation and economy resolution match keyed technical knowledge entries instead of treating any knowledge as equivalent | `implemented` | Knowledge is still stored as string keys rather than a richer typed/source-tracked model |
| Technical Knowledge from trade | Can be borrowed from a partner at +25% cost | Keyed traded technical knowledge unlocks the prerequisite and the economy path applies the 25% surcharge | `implemented` | Source tracking is still implicit in current trade access, not persisted as a separate graph |
| Siege Weapon Workshop | Only one siege weapon type may be built at a time | No queue or exclusivity model exists | `missing` | Needs per-building production state |
| Custom buildings | GM may define custom buildings and sizes/effects | No typed custom-building registry exists | `missing` | Needs a GM-authored definition layer, not free-form notes |

## Contract Implications

The current backend already has one usable canonical path for:

- settlement food/wealth projection
- tax revenue projection
- recurring upkeep costs
- draft build/recruit cost capture
- per-turn economy snapshots and ledger entries

The main gaps are not arithmetic gaps. They are authority gaps:

- trade exports/imports are stored as inputs when they should be derived
- several building and fortification rules need location and slot semantics that the schema cannot express
- shortage/turmoil and imported-material/technical-knowledge effects need typed resolution outputs instead of warnings
- rule validation is currently mixed into persistence and action entry, rather than existing as its own contract boundary
