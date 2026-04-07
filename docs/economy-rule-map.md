# Economy Rule Map

This is the short developer map for the canonical economy engine.

Authoritative resolution entrypoint:

- `src/lib/economy-service.ts#createEconomyService().advanceGameTurn()`

The seasonal resolver loads current state, validates typed inputs, resolves trade and accounting, persists ledger snapshots, mutates realm state, advances timers, and moves the game to the next season in one transaction.

## Rule Families

| Rule family | Primary implementation | Notes | Main tests |
| --- | --- | --- | --- |
| Seasonal turn orchestration | `src/lib/economy-service.ts` | Canonical transaction boundary and idempotent replay | `src/lib/economy-service.test.ts` |
| Tax application and levy expiry | `src/lib/game-logic/economy.ts` | Applies current-turn tax changes, levy expiry, and warnings | `src/lib/game-logic/economy.test.ts`, `src/lib/economy-service.test.ts` |
| Settlement wealth and food wealth | `src/lib/game-logic/economy.ts`, `src/lib/game-logic/wealth.ts`, `src/lib/game-logic/food.ts` | Computes resource wealth, food production, and settlement totals | `src/lib/game-logic/economy.test.ts`, `src/lib/game-logic/food.test.ts`, `src/lib/game-logic/wealth.test.ts` |
| Food shortage and recovery | `src/lib/game-logic/economy.ts`, `src/lib/game-logic/turmoil.ts` | Tracks shortage streaks, recovery streaks, and shortage turmoil sources | `src/lib/game-logic/economy.test.ts`, `src/lib/economy-service.test.ts` |
| Products, industry legality, and quality tiers | `src/lib/game-logic/products.ts` | Shared resolver for legality, degradation, wealth, and trade quality | `src/lib/game-logic/products.test.ts` |
| Trade monopoly resolution and protection | `src/lib/game-logic/trade.ts` | Derives import winners, exports, tie handling, and protection windows | `src/lib/game-logic/trade.test.ts` |
| Trade-driven economy projection | `src/lib/game-logic/economy.ts` | Consumes derived trade state, not stored route exports | `src/lib/game-logic/economy.test.ts` |
| Recurring upkeep | `src/lib/game-logic/economy.ts`, `src/lib/game-logic/upkeep.ts` | Covers buildings, troops, siege, nobles, prisoners, and guild first-free upkeep | `src/lib/game-logic/economy.test.ts`, `src/lib/game-logic/upkeep.test.ts` |
| Draft build and recruit actions | `src/lib/game-logic/economy.ts`, `src/lib/economy-service.ts` | Projection records pending entities; resolution persists them and advances timers | `src/lib/game-logic/economy.test.ts`, `src/lib/economy-service.test.ts` |
| Typed GM economy modifiers | `src/lib/game-logic/economic-modifiers.ts`, `src/lib/economy-service.ts`, `src/app/api/game/[gameId]/events/route.ts` | GM overrides enter only as typed modifier payloads on `turn_events` | `src/lib/game-logic/economy.test.ts`, `src/lib/economy-service.test.ts`, `src/app/api/game/[gameId]/events/route.test.ts` |

## GM Override Flow

1. GM submits a turn event through `POST /api/game/[gameId]/events`.
2. `src/app/api/game/[gameId]/events/route.ts` normalizes the payload with `normalizeEconomicModifiers()`.
3. The typed modifier JSON is stored in `turn_events.mechanical_effect`.
4. `src/lib/economy-service.ts` loads current-turn events and parses them with `parseStoredEconomicModifiers()`.
5. Parsed modifiers are injected into each realm as `seasonalModifiers`.
6. `src/lib/game-logic/economy.ts` applies treasury, food, technical knowledge, and turmoil modifier effects.
7. Untyped/free-form event effects are rejected at resolution time by economy validation.

## Regression Fixtures

Shared fixtures for tricky scenarios live in:

- `src/__tests__/fixtures/economy-regression-fixtures.ts`

Current fixtures cover:

- protected trade-import incumbent scenarios
- food-shortage recovery scenarios
- reusable baseline economy realm state

## Intentionally Deferred Clauses

These clauses are still intentionally out of scope for the current engine:

- Territory-level food caps and cap bonuses are not applied in realm food resolution yet.
- Relationship-based trade tie-breaks are not automatic because there is no realm relationship graph.
- Imported materials for building and recruitment validation are still incomplete outside technical-knowledge surcharge handling.
- Port and path validation for water trade is not enforced by the economy engine.
- Building-specific allotment systems for banks, orders, and societies remain partially modeled.
- Siege workshop queue exclusivity is not modeled.
- Custom GM-authored building definitions are not part of the typed economy model.

For the broader audit and contract notes, see `docs/economy-rule-coverage-matrix.md` and `docs/economy-backend-contract.md`.
