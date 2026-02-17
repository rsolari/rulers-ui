# Rulers Game Tracker - Implementation Plan

## Overview

A web application to track all game state for "Rulers," a tabletop RPG of conquest, politics, and civilization-building. Players play the game verbally, but the app manages all state: realms, settlements, armies, nobles, trade, turmoil, treasury, and turn progression. The GM (Narrative Overlord) has full visibility and edit access; each player sees and manages their own realm.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Full-stack, SSR, API routes, Vercel-native |
| Language | **TypeScript** | Type safety for the complex game data model |
| Database | **SQLite via Drizzle ORM** | Single-tenant, simple deployment, file-based; can migrate to Postgres later if needed |
| Styling | **Tailwind CSS** + custom medieval/parchment theme | Utility-first CSS with themed components |
| UI Components | Custom components (no shadcn) | Full control over the medieval aesthetic |
| Hosting | **Vercel** (or any Node-capable host) | Native Next.js support, easy deploys |
| Real-time | **Not in MVP** | Polling/refresh for now; WebSockets can be added later |
| Auth | **Game codes** | GM creates game -> gets a code. Players join with code. No accounts needed. Codes stored in cookies/localStorage. |

---

## Design Theme: Medieval/Parchment

- Parchment-textured backgrounds (CSS gradients + subtle texture images)
- Serif fonts for headings (e.g., `Cinzel`, `MedievalSharp`)
- Dark brown/gold/cream color palette
- Decorative borders on cards and panels
- Wax-seal-style buttons for primary actions
- Subtle ink/quill aesthetic for form inputs
- Icon set: swords, shields, crowns, scrolls, coins

---

## Data Model

### Core Entities

#### Game
```
Game {
  id: string (UUID)
  name: string
  gmCode: string (unique, 6-char)
  playerCode: string (unique, 6-char)
  currentYear: number (starts at 1)
  currentSeason: enum (Spring, Summer, Autumn, Winter)
  turnPhase: enum (Submission, Resolution, Complete)
  createdAt: timestamp
}
```

#### Realm
```
Realm {
  id: string
  gameId: string -> Game
  name: string
  governmentType: enum (Monarch, ElectedMonarch, Council, Ecclesiastical, Consortium, Magistrate, Warlord)
  traditions: string[] (exactly 3, from predefined list)
  treasury: number (gold)
  taxType: enum (Tribute, Levy)
  turmoil: number
  turmoilSources: JSON (tracks each source + duration)
  sessionCode: string (unique per-realm join code, optional)
}
```

#### Territory
```
Territory {
  id: string
  gameId: string -> Game
  name: string
  realmId: string? -> Realm (null = neutral/NPC)
  climate: string
  description: string
}
```

#### Settlement
```
Settlement {
  id: string
  territoryId: string -> Territory
  realmId: string -> Realm
  name: string
  size: enum (Village, Town, City)
  buildingSlots: number (derived: Village=4, Town=6, City=8)
  governingNobleId: string? -> Noble
  garrisonTroops: relation -> Troop[]
}
```

#### Building
```
Building {
  id: string
  settlementId: string -> Settlement
  type: enum (all building types from rules)
  category: enum (Civic, Industrial, Military, Fortification)
  size: enum (Tiny, Small, Medium, Large, Colossal)
  material: enum? (Timber, Stone) -- for fortifications
  constructionTurnsRemaining: number (0 = complete)
  isGuildOwned: boolean
  guildId: string? -> Guild
}
```

#### Resource Site
```
ResourceSite {
  id: string
  territoryId: string -> Territory
  settlementId: string? -> Settlement (which settlement it's near)
  resourceType: enum (Timber, Clay, Iron, Stone, Silver, Porcelain, Lacquer, Jewels, Cotton, Marble, Gold, Spices, Tea, Coffee, Tobacco, Opium, Silk, Salt, Sugar)
  rarity: enum (Common, Luxury)
}
```

#### Industry
```
Industry {
  id: string
  resourceSiteId: string -> ResourceSite
  quality: enum (Basic, HighQuality)
  ingredients: string[] (other resource types combined)
  wealthGenerated: number (auto-calculated)
  guildId: string? -> Guild
}
```

#### Noble Family
```
NobleFamily {
  id: string
  realmId: string -> Realm
  name: string
  isRulingFamily: boolean
}
```

#### Noble
```
Noble {
  id: string
  familyId: string -> NobleFamily
  realmId: string -> Realm
  name: string
  gender: enum (Male, Female)
  age: enum (Infant, Adolescent, Adult, Elderly)
  isRuler: boolean
  isHeir: boolean

  // Personality (from generation tables)
  personality: string
  relationshipWithRuler: string
  belief: string
  valuedObject: string
  valuedPerson: string
  greatestDesire: string

  // Assignment
  title: string? (Lord of X, General, Agent, Guild Head, etc.)
  assignedSettlementId: string? -> Settlement
  assignedArmyId: string? -> Army
  assignedGuildId: string? -> Guild

  // Estate
  estateLevel: enum (Meagre, Comfortable, Ample, Substantial, Luxurious)

  // Skills
  reasonSkill: number
  cunningSkill: number

  // Status
  isPrisoner: boolean
  prisonerOfRealmId: string? -> Realm
  locationTerritoryId: string? -> Territory
}
```

#### Army
```
Army {
  id: string
  realmId: string -> Realm
  name: string
  generalId: string? -> Noble
  locationTerritoryId: string -> Territory
  destinationTerritoryId: string? -> Territory
  movementTurnsRemaining: number
}
```

#### Troop
```
Troop {
  id: string
  realmId: string -> Realm
  type: enum (Spearmen, Archers, Shieldbearers, Berserkers, Crossbowmen, Harquebusiers, LightCavalry, Pikemen, Swordsmen, Fusiliers, Cavalry, MountedArchers, Dragoons)
  class: enum (Basic, Elite)
  armourType: enum (Light, Armoured, Mounted)
  condition: enum (Healthy, Wounded1, Wounded2, Routed1, Routed2, Defeated, Crushed)

  // Assignment: either in an army or garrisoned in a settlement
  armyId: string? -> Army
  garrisonSettlementId: string? -> Settlement

  // Recruitment tracking
  recruitmentTurnsRemaining: number (0 = ready)
}
```

#### Siege Unit
```
SiegeUnit {
  id: string
  realmId: string -> Realm
  type: enum (Catapult, Trebuchet, Ballista, BatteringRam, Cannon)
  armyId: string? -> Army
  garrisonSettlementId: string? -> Settlement
  constructionTurnsRemaining: number (0 = ready)
}
```

#### Trade Route
```
TradeRoute {
  id: string
  gameId: string -> Game
  realm1Id: string -> Realm
  realm2Id: string -> Realm
  settlement1Id: string -> Settlement
  settlement2Id: string -> Settlement
  isActive: boolean
  productsExported1to2: string[] (resource types)
  productsExported2to1: string[]
  protectedProducts: JSON (product + expiry season)
}
```

#### Guild / Order / Society
```
GuildOrderSociety {
  id: string
  realmId: string -> Realm
  name: string
  type: enum (Guild, Order, Society)
  focus: string (what they do / monopoly)
  leaderId: string? -> Noble
  income: number (auto-calculated)
}
```

#### Turn Report
```
TurnReport {
  id: string
  gameId: string -> Game
  realmId: string -> Realm
  year: number
  season: enum

  // Financial actions
  financialActions: JSON (buildings to construct, troops to recruit, tax changes, other spending)

  // Political actions (max 6 action words)
  politicalActions: JSON (array of { actionWords: string[], description: string, targetRealmId?: string, assignedNobleId?: string })

  // Status
  status: enum (Draft, Submitted, Resolved)
  gmNotes: string? (N.O. resolution notes)
}
```

#### Turn Event
```
TurnEvent {
  id: string
  gameId: string -> Game
  year: number
  season: enum
  realmId: string? -> Realm (null = global event)
  description: string
  mechanicalEffect: string?
}
```

---

## Auto-Calculated Values

The app will automatically compute these derived values from the raw state:

### Per Settlement
- **Food Produced** = empty building slots (total slots - occupied slots)
- **Food Needed** = Village: 1, Town: 2, City: 4
- **Base Wealth** = sum of all resource site wealth + (food produced * 2,000g)
- **Trade Bonus** = +5% per product exported (+ additional 10% if Mercantile tradition)
- **Total Wealth** = Base Wealth * (1 + trade bonuses)
- **Growth Check** = if (occupied slots >= total slots - 1), show "ready to grow" indicator

### Per Realm
- **Total Income** = sum of all settlement wealth * tax rate (15% or 30%)
- **Building Upkeep** = sum of all building maintenance costs
- **Troop Upkeep** = sum of all troop upkeep costs
- **Noble Estate Upkeep** = sum of all noble estate costs (ruler excluded)
- **Prisoner Upkeep** = sum of prisoner costs (1/4 troop upkeep or 125g for nobles)
- **Guild/Order/Society Income** = auto-calculated per type rules
- **Total Upkeep** = building + troop + noble estate + prisoner upkeep
- **Net Income** = total income + G.O.S. income - total upkeep
- **Total Food Produced** = sum across all settlements (capped at 30 per territory before bonuses)
- **Total Food Needed** = sum across all settlements + forts (1) + castles (2)
- **Food Surplus/Deficit** = produced - needed
- **Turmoil Total** = base tax turmoil + all active turmoil sources (tracked with durations)
- **Available Action Words** = 6 - used this turn

### Per Army
- **Movement Speed** = base 1 territory/turn + modifiers (all-light: +1, all-mounted-light: +2, all-mounted-armoured: +1, Pathfinder tradition: +1)
- **Quick Combat Dice Pool** = calculated from troop composition + bonuses

### Per Trade Route
- **Exported Products** = auto-detected: all products realm1 produces that realm2 does not (and vice versa)
- **Wealth Bonus per Settlement** = +5% of settlement total wealth per product exported from that settlement
- **Mercantile Bonus** = additional +10% if exporting realm has Mercantile tradition
- **Product Quality Tier** = ranked 1-8 (Basic, HQ, Basic+1, HQ+1, Basic+2, HQ+2, Basic+3, HQ+3)
- **Price Competition Winner** = highest quality tier wins; if tied, lower tax rate wins; if tied, GM decides
- **Import Cost Surcharge** = +25% for buildings/troops built using traded resources
- **Protection Timer** = when a product import source changes, new product is protected for 2 seasons (tracked with expiry turn)
- **Port Requirement** = flag if route crosses water and either settlement lacks a Port (route invalid)
- **Blockade Check** = if either settlement is under blockade, route is suspended (no products flow, no wealth bonus)

### Wealth from Resources (auto-calculated per industry)
- Common Resource (standalone): 10,000g
- Luxury Resource (standalone): 15,000g
- Luxury without required component: half value
- Combined products: look up combination table (10k/15k/20k/25k/35k based on ingredients)

---

## Application Structure

### Pages & Routes

```
/                           -> Landing page (create/join game)
/game/[gameId]              -> Game dashboard (redirects based on role)

# GM Views
/game/[gameId]/gm           -> GM dashboard (overview of all realms)
/game/[gameId]/gm/turn      -> Turn management (current season, advance turn, resolve reports)
/game/[gameId]/gm/realms    -> All realms list
/game/[gameId]/gm/realm/[id] -> Detailed realm view (editable)
/game/[gameId]/gm/trade     -> All trade routes overview (cross-realm view)
/game/[gameId]/gm/events    -> Event log + random event roller
/game/[gameId]/gm/dice      -> Dice roller utility

# Player Views
/game/[gameId]/realm        -> Player's realm dashboard
/game/[gameId]/realm/settlements -> Settlements manager
/game/[gameId]/realm/nobles  -> Noble families manager
/game/[gameId]/realm/army    -> Armies & troops manager
/game/[gameId]/realm/treasury -> Treasury & income breakdown
/game/[gameId]/realm/trade   -> Trade routes manager
/game/[gameId]/realm/report  -> Submit turn report
/game/[gameId]/realm/dice    -> Dice roller utility

# Shared
/game/[gameId]/setup         -> Game setup wizard (GM only, but players participate in realm creation)
```

### Key UI Components

#### Game Setup Wizard (5 steps)
1. **Create Game** - Game name, generates GM code and player code
2. **World Setup** - Define territories, climates (with optional random generation using game's tables)
3. **Place Resources** - Assign common/luxury resources to territories (with optional random roll)
4. **Realm Creation** - Each player (or GM for NPCs) creates a realm:
   - Choose government type
   - Pick 3 traditions
   - Assign territory
   - Name settlements (4 villages + 1 town)
   - Place starting resources at settlements
   - Generate noble families (wizard with random rolls or manual entry)
   - Create ruler character
   - Place starting 5 troops as garrisons
5. **Review & Start** - Overview of all realms, confirm, begin Year 1 Spring

#### Realm Dashboard
- **Header**: Realm name, government type, ruler name, current season/year
- **Summary Cards**: Treasury, Net Income, Food Balance, Turmoil, Army Size, Active Trade Routes
- **Quick Actions**: Submit report, view settlements, manage armies, manage trade
- **Alerts**: Food shortage warnings, turmoil thresholds, unpaid nobles, settlements ready to grow, trade competition warnings, blockaded routes

#### Settlement Detail View
- Settlement name, size, governing noble
- Building grid (visual slots showing occupied/empty)
- Resource sites listed with wealth generated
- Food produced vs. needed
- Garrison list
- Fortification status
- Trade routes connected
- Construction queue (buildings in progress)

#### Army Manager
- List of armies with general, location, troop count
- Troop detail table: type, class, condition, assigned army/garrison
- Recruitment queue
- Movement orders

#### Treasury Breakdown
- Income sources table (per settlement, per resource, trade bonuses)
- Upkeep table (buildings, troops, nobles, prisoners)
- Net calculation
- Bank loan status (if applicable)
- Historical treasury graph (per turn)

#### Turn Report Form
- **Financial Actions Section**:
  - Buildings to construct (dropdown: settlement -> building type, auto-validates slots/resources/gold)
  - Troops to recruit (dropdown: settlement -> troop type, auto-validates buildings/resources/gold)
  - Tax rate change (toggle, max 1 per turn)
  - Other spending (free text + gold amount)
- **Political Actions Section**:
  - Up to 6 action word slots
  - Each slot: pick action word(s) from dropdown, describe the action in free text
  - Optional: assign to a noble agent, set target realm, set trigger condition
- **Action Word Counter**: shows X/6 used
- **Cost Summary**: total gold spent this turn vs. available treasury
- **Submit button** (changes status from Draft -> Submitted)

#### GM Turn Resolution View
- List of all submitted reports side-by-side
- Per report: financial actions (with validation checks shown), political actions
- GM can add notes/outcomes to each action
- "Resolve Turn" button: applies all financial changes, advances season
- Auto-calculates new treasury for each realm
- Prompts for random events at start of each new year (every 4th turn)

#### Dice Roller
- Select dice type: d6, d8, d10
- Set number of dice
- Roll button with animated result
- Preset rolls:
  - Quick Combat (enter troop counts, calculates dice pool)
  - Turmoil Roll (auto-pulls current turmoil value)
  - Noble Reason/Cunning Check (5d6)
  - Random Event (various tables from the rules)
  - Noble Personality Generator (rolls all personality tables)
  - Resource Generation (rolls on common/luxury tables)
- Results displayed clearly but NOT auto-applied to game state
- Roll history log

#### Trade Route Manager
- **Active Routes List**: shows each route with partner realm, connected settlements, products flowing each direction, and wealth bonus
- **Create Route**: select partner realm -> select your settlement -> select their settlement (requires Port if over water) -> auto-detects which products each side exports (products the partner doesn't have)
- **Product Detail per Route**: table showing each product, its quality tier (Basic through HQ+3 ingredients), direction of flow, and whether it's protected (with expiry season)
- **Price Competition Alerts**: when a new trade partner could displace an existing import (higher quality or lower tax), show a warning with the quality hierarchy comparison
- **Wealth Bonus Summary**: per settlement, show the +5% per exported product breakdown (and +10% Mercantile if applicable)
- **Resource Availability Indicator**: show which resources are available via trade (with the +25% cost surcharge flag)
- **Close Route**: button to end a trade agreement (with turmoil impact warning: +1 turmoil)
- **Blockade Status**: if a settlement is under blockade, trade routes through it are shown as suspended with a visual indicator
- **GM Trade Overview** (GM-only page): cross-realm view of all active trade routes in the game, displayed as a network/list showing which realms trade with whom and what flows between them

#### Turmoil Tracker
- Current turmoil value with breakdown of all sources
- Duration tracking per source (some last 4 seasons, some until resolved)
- Visual indicator of severity
- Winter turmoil roll button (dice roller preset)
- Result lookup table displayed alongside

---

## Turn Lifecycle (Structured Flow)

```
1. SUBMISSION PHASE
   - App displays current season/year
   - Players can create/edit their Turn Reports (Draft status)
   - Players submit reports (Submitted status)
   - GM sees submission status for all realms
   - GM can also edit any realm's state directly at any time

2. RESOLUTION PHASE (GM triggers)
   - GM reviews all submitted reports
   - GM resolves political actions (adds notes/outcomes)
   - GM clicks "Resolve Turn"
   - System auto-applies financial actions:
     * Deducts building/troop construction costs
     * Starts construction timers
     * Applies tax rate changes
     * Deducts other spending
   - System auto-advances construction/recruitment timers (decrement by 1)
   - System auto-completes buildings/troops where timer hits 0
   - System auto-calculates new income and upkeep
   - System applies income - upkeep to treasury
   - System checks and flags food shortages
   - System advances turmoil source durations
   - If new year (Winter -> Spring): prompt GM for random events

3. COMPLETE PHASE
   - Turn results visible to all players
   - Season advances (Spring->Summer->Autumn->Winter->Spring+1)
   - New turn begins (back to Submission phase)
```

---

## MVP Feature Scope

### Must Have (v1.0)
- [x] Game creation with GM/player codes
- [x] Game setup wizard (realm creation, territories, resources)
- [x] Realm dashboard with summary cards
- [x] Settlement management (buildings, slots, food, garrison)
- [x] Noble family tracking (members, estates, assignments)
- [x] Army/troop tracking (composition, condition, location)
- [x] Treasury with auto-calculated income/upkeep/net
- [x] Turmoil tracking with source management
- [x] Turn management (season/year, submission/resolution cycle)
- [x] Turn report submission (financial + political actions)
- [x] GM turn resolution with auto-applied financial changes
- [x] Dice roller with presets (not auto-applied)
- [x] Medieval/parchment UI theme
- [x] Food production/need tracking with alerts
- [x] Building construction queue with timers
- [x] Trade route management (create/close routes, product tracking, wealth bonuses, price competition)

### Deferred (v2.0+)
- [ ] Real-time updates (WebSockets)
- [ ] Interactive visual map
- [ ] Full combat resolution system (auto-calculate battle outcomes)
- [ ] Siege mechanics
- [ ] Bank/loan tracking
- [ ] Game history/timeline view
- [ ] Export/import game state (JSON)
- [ ] Multiple concurrent games
- [ ] Mobile-optimized layout
- [ ] NPC realm AI/automation

---

## File Structure

```
cebu/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with medieval theme
│   │   ├── page.tsx                    # Landing: create/join game
│   │   ├── globals.css                 # Tailwind + parchment theme vars
│   │   └── game/
│   │       └── [gameId]/
│   │           ├── layout.tsx          # Game layout (nav, role detection)
│   │           ├── page.tsx            # Redirect based on role
│   │           ├── setup/
│   │           │   └── page.tsx        # Game setup wizard
│   │           ├── gm/
│   │           │   ├── page.tsx        # GM dashboard
│   │           │   ├── turn/
│   │           │   │   └── page.tsx    # Turn management
│   │           │   ├── realms/
│   │           │   │   └── page.tsx    # All realms overview
│   │           │   ├── realm/
│   │           │   │   └── [realmId]/
│   │           │   │       └── page.tsx # Realm detail (editable)
│   │           │   ├── trade/
│   │           │   │   └── page.tsx    # GM trade network overview
│   │           │   ├── events/
│   │           │   │   └── page.tsx    # Event log
│   │           │   └── dice/
│   │           │       └── page.tsx    # Dice roller
│   │           └── realm/
│   │               ├── page.tsx        # Player realm dashboard
│   │               ├── settlements/
│   │               │   └── page.tsx    # Settlement manager
│   │               ├── nobles/
│   │               │   └── page.tsx    # Noble families
│   │               ├── army/
│   │               │   └── page.tsx    # Army manager
│   │               ├── trade/
│   │               │   └── page.tsx    # Trade routes manager
│   │               ├── treasury/
│   │               │   └── page.tsx    # Treasury breakdown
│   │               ├── report/
│   │               │   └── page.tsx    # Turn report
│   │               └── dice/
│   │                   └── page.tsx    # Dice roller
│   ├── components/
│   │   ├── ui/                         # Base UI components (medieval themed)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── game/                       # Game-specific components
│   │   │   ├── realm-summary-card.tsx
│   │   │   ├── settlement-grid.tsx
│   │   │   ├── building-slot.tsx
│   │   │   ├── troop-row.tsx
│   │   │   ├── noble-card.tsx
│   │   │   ├── treasury-breakdown.tsx
│   │   │   ├── turmoil-tracker.tsx
│   │   │   ├── trade-route-card.tsx
│   │   │   ├── trade-route-form.tsx
│   │   │   ├── trade-product-table.tsx
│   │   │   ├── trade-network-view.tsx    # GM cross-realm trade overview
│   │   │   ├── turn-report-form.tsx
│   │   │   ├── dice-roller.tsx
│   │   │   ├── action-word-picker.tsx
│   │   │   └── season-indicator.tsx
│   │   └── setup/                      # Setup wizard components
│   │       ├── wizard-shell.tsx
│   │       ├── world-setup-step.tsx
│   │       ├── resource-placement-step.tsx
│   │       ├── realm-creation-step.tsx
│   │       ├── noble-generator.tsx
│   │       └── review-step.tsx
│   ├── db/
│   │   ├── schema.ts                   # Drizzle schema (all tables)
│   │   ├── index.ts                    # DB connection
│   │   └── migrations/                 # Auto-generated migrations
│   ├── lib/
│   │   ├── game-logic/
│   │   │   ├── wealth.ts               # Wealth calculation (resources, trade, taxes)
│   │   │   ├── food.ts                 # Food production/need calculations
│   │   │   ├── upkeep.ts               # Building, troop, noble upkeep calculations
│   │   │   ├── turmoil.ts              # Turmoil calculation and source tracking
│   │   │   ├── trade.ts                # Trade route logic (product matching, price competition, wealth bonuses)
│   │   │   ├── combat.ts               # Dice pool calculations for combat
│   │   │   ├── recruitment.ts          # Troop/building validation (requirements, slots, caps)
│   │   │   ├── turn-resolution.ts      # Auto-apply turn changes
│   │   │   └── constants.ts            # All game constants (costs, rates, tables)
│   │   ├── dice.ts                     # Dice rolling utilities
│   │   ├── tables.ts                   # All random generation tables from rules
│   │   └── auth.ts                     # Game code validation, role detection
│   ├── hooks/
│   │   ├── use-game.ts                 # Game state context/hooks
│   │   ├── use-realm.ts                # Current realm data
│   │   └── use-role.ts                 # GM vs player role
│   └── types/
│       └── game.ts                     # TypeScript types/enums for all game entities
├── public/
│   └── textures/                       # Parchment backgrounds, decorative elements
├── drizzle.config.ts
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## API Routes (Next.js Server Actions or Route Handlers)

### Game Management
- `POST /api/game` - Create new game (returns GM code + player code)
- `GET /api/game/[gameId]` - Get game state
- `POST /api/game/[gameId]/join` - Join game with code (returns role + realm assignment)

### Realm CRUD
- `GET /api/game/[gameId]/realms` - List all realms (GM) or own realm (player)
- `POST /api/game/[gameId]/realms` - Create realm (during setup)
- `PATCH /api/game/[gameId]/realm/[realmId]` - Update realm (GM or owning player)

### Settlement CRUD
- `GET /api/game/[gameId]/realm/[realmId]/settlements` - List settlements
- `POST /api/game/[gameId]/realm/[realmId]/settlements` - Create settlement
- `PATCH /api/game/[gameId]/realm/[realmId]/settlement/[id]` - Update settlement
- `POST /api/game/[gameId]/realm/[realmId]/settlement/[id]/build` - Start building construction

### Noble CRUD
- `GET /api/game/[gameId]/realm/[realmId]/nobles` - List nobles
- `POST /api/game/[gameId]/realm/[realmId]/nobles` - Create noble
- `PATCH /api/game/[gameId]/realm/[realmId]/noble/[id]` - Update noble
- `POST /api/game/[gameId]/realm/[realmId]/nobles/generate` - Random noble generation

### Army/Troop CRUD
- `GET /api/game/[gameId]/realm/[realmId]/armies` - List armies
- `POST /api/game/[gameId]/realm/[realmId]/armies` - Create army
- `PATCH /api/game/[gameId]/realm/[realmId]/army/[id]` - Update army
- `POST /api/game/[gameId]/realm/[realmId]/troops` - Recruit troop
- `PATCH /api/game/[gameId]/realm/[realmId]/troop/[id]` - Update troop (condition, assignment)

### Trade Routes
- `GET /api/game/[gameId]/trade-routes` - List all trade routes (GM sees all; player sees own realm's routes)
- `POST /api/game/[gameId]/trade-routes` - Create trade route (requires both realms' agreement, or GM override)
- `PATCH /api/game/[gameId]/trade-route/[id]` - Update trade route (activate, suspend, update products)
- `DELETE /api/game/[gameId]/trade-route/[id]` - Close/end trade route
- `GET /api/game/[gameId]/trade-routes/products/[realmId]` - Get all products a realm produces (for computing what can be exported)
- `GET /api/game/[gameId]/trade-routes/competition/[realmId]` - Check for price competition conflicts (returns products at risk of displacement)

### Turn Management
- `GET /api/game/[gameId]/turn` - Current turn state
- `POST /api/game/[gameId]/turn/report` - Submit turn report
- `PATCH /api/game/[gameId]/turn/report/[id]` - Update draft report
- `POST /api/game/[gameId]/turn/resolve` - GM resolves turn (triggers auto-calculations)
- `POST /api/game/[gameId]/turn/advance` - Advance to next season

### Utilities
- `POST /api/dice/roll` - Roll dice (stateless, just returns results)
- `GET /api/tables/[tableName]` - Get random generation table data

---

## Game Logic: Auto-Calculation Details

### Wealth Calculation Pipeline (per settlement, per turn)

```
1. For each Resource Site connected to settlement:
   a. Look up base wealth (Common=10k, Luxury=15k)
   b. Check luxury dependency (e.g., Jewels needs Gold/Lacquer/Porcelain)
      - If missing dependency and not available via trade: half wealth
   c. Check Industry quality and ingredients:
      - Apply combination table for multi-ingredient products
   d. Sum all resource wealth

2. Calculate food wealth:
   a. Empty slots = building_slots - occupied_slots
   b. Food produced = empty slots (capped at territory max of 30)
   c. Food wealth = food_produced * 2,000g

3. Calculate trade bonus:
   a. Count products exported from this settlement
   b. Trade bonus = products_exported * 5%
   c. If Mercantile tradition: add +10%

4. Settlement total wealth = (resource_wealth + food_wealth) * (1 + trade_bonus)
```

### Income Calculation (per realm, per turn)
```
1. Sum all settlement total wealth
2. Apply tax rate: Tribute=15%, Levy=30%
3. Add Guild/Order/Society income
4. Result = gross income
```

### Upkeep Calculation (per realm, per turn)
```
1. Building upkeep = sum of all completed building maintenance costs
   (first G.O.S. building is free for each G.O.S.)
2. Troop upkeep = sum of all troop upkeep by type
3. Noble estate upkeep = sum of all noble estate costs (ruler free)
4. Prisoner upkeep = sum of prisoner costs
5. Siege unit upkeep = sum of siege unit upkeep
6. Total upkeep = 1 + 2 + 3 + 4 + 5
```

### Trade Route Calculation Pipeline

```
1. Product Detection (per route):
   a. Get all resource types produced by realm1 (from ResourceSites + Industries)
   b. Get all resource types produced by realm2
   c. Products exported 1->2 = realm1 products NOT in realm2's production
   d. Products exported 2->1 = realm2 products NOT in realm1's production
   e. Exclude products blocked by existing monopoly imports from other routes

2. Price Competition (when multiple routes could supply the same product):
   a. Rank all potential sources by quality tier (1-8):
      1. Basic product
      2. High Quality product
      3. Basic + 1 Ingredient
      4. HQ + 1 Ingredient
      5. Basic + 2 Ingredients
      6. HQ + 2 Ingredients
      7. Basic + 3 Ingredients
      8. HQ + 3 Ingredients
   b. Highest quality wins the import
   c. If tied: lower tax rate wins (Tribute < Levy)
   d. If still tied: GM decides (flag for manual resolution)
   e. When import source changes: new product gets 2-season protection timer

3. Wealth Bonus (per settlement with active routes):
   a. Count products exported FROM this settlement
   b. Base trade bonus = exported_count * 5%
   c. If realm has Mercantile tradition: bonus += 10%
   d. Apply bonus to settlement's total base wealth

4. Resource Availability:
   a. Each realm treated as having access to trade partner's resources
   b. Buildings/troops using traded resources cost +25%
   c. If a luxury resource lacks its dependency locally but has it via trade:
      full wealth (not half)

5. Validation:
   a. Port required for water crossings (check both settlements)
   b. A realm cannot import the same product from multiple sources
   c. Blockaded settlements suspend all trade routes through them
```

### Turn Resolution Auto-Actions
```
When GM clicks "Resolve Turn":
1. For each realm with a submitted report:
   a. Deduct construction costs for new buildings/troops
   b. Start construction timers
   c. Apply tax rate changes (max 1)
2. For all realms:
   a. Decrement all construction timers by 1
   b. Complete any buildings/troops where timer hits 0
   c. Process trade routes:
      * Re-evaluate exported products for all active routes (a new industry or lost resource may change what flows)
      * Run price competition checks (if a new route offers higher quality, flag displacement)
      * Decrement protection timers on protected products; expire any that hit 0
      * Check blockade status; suspend routes to blockaded settlements
      * Calculate per-settlement trade wealth bonuses (+5% per exported product, +10% Mercantile)
   d. Calculate new income and upkeep (including trade bonuses in settlement wealth)
   e. Apply net income to treasury (treasury += income - upkeep)
   f. Check food balance -> flag shortages (blockaded settlements lose access to imported food)
   g. Update turmoil source durations (decrement, remove expired)
   h. Check settlement growth conditions
3. If Winter -> Spring transition:
   a. Prompt GM for annual random events (1 per realm)
   b. Turmoil roll reminder for each realm
4. Advance season
```

---

## Implementation Phases

### Phase 1: Foundation (estimated: first sprint)
1. Initialize Next.js project with TypeScript, Tailwind
2. Set up Drizzle ORM with SQLite schema
3. Implement medieval/parchment theme (CSS variables, fonts, base components)
4. Build landing page (create game / join game)
5. Implement game code auth (cookies)
6. Build base UI components (Button, Card, Input, Select, Table, Badge, Dialog)

### Phase 2: Game Setup (second sprint)
1. Game setup wizard shell (multi-step form)
2. Territory/world creation step
3. Resource placement step (with random roll option)
4. Realm creation step (government, traditions, settlements, resources)
5. Noble family generator (random rolls + manual entry)
6. Review & start step

### Phase 3: Core State Tracking (third sprint)
1. Realm dashboard with summary cards
2. Settlement management (CRUD, building slots grid, construction queue)
3. Noble family management (CRUD, estate tracking, assignments)
4. Army/troop management (CRUD, condition tracking, garrison assignment)
5. Trade route management (create/close routes, auto-detect products, price competition, wealth bonuses)
6. Treasury breakdown view (income, upkeep, trade bonuses, net - all auto-calculated)
7. Game constants module (all costs, rates, tables from rules)

### Phase 4: Turn System (fourth sprint)
1. Turn report form (financial actions + political actions + validation)
2. Action word picker (dropdown with all 35 words)
3. GM turn resolution view (review reports, add notes)
4. Auto-resolution engine (apply financial changes, advance timers, calculate new values)
5. Season/year advancement
6. Turn history log

### Phase 5: Turmoil & Dice (fifth sprint)
1. Turmoil tracker with source management
2. Turmoil duration tracking (auto-expire after 4 seasons where applicable)
3. Food shortage detection and escalation tracking
4. Dice roller with all presets (combat, turmoil, noble checks, generation tables)
5. Roll history log

### Phase 6: GM Tools & Polish (sixth sprint)
1. GM dashboard (all realms overview, alerts)
2. GM direct edit capability (edit any realm's state)
3. Event log (record events, random event roller for new years)
4. Alert system (food shortages, turmoil thresholds, unpaid nobles, growth ready)
5. Polish UI, fix edge cases, responsive layout
6. Deploy to Vercel

---

## Key Design Decisions

1. **SQLite over Postgres**: Single-tenant app, simpler deployment, no external DB service needed. Drizzle makes migration to Postgres trivial if needed later.

2. **No real-time in MVP**: Reduces complexity significantly. Players refresh to see updates. Can add Server-Sent Events or WebSockets in v2.

3. **Auto-calculate but don't auto-apply dice**: The app computes all deterministic values (income, upkeep, food) but dice results are advisory only. This keeps the GM in control of narrative outcomes.

4. **Hybrid report system**: Players CAN submit formal reports through the app, but the GM can also just edit state directly. This supports both structured play-by-post style and casual in-person sessions.

5. **Game codes over accounts**: Minimizes friction. GM gets two codes (one for GM access, one for players). Players enter code + pick their realm. Stored in cookies.

6. **Construction timers as turn-based counters**: Buildings and troops have a `turnsRemaining` counter that decrements on turn resolution. No real-time timers.

7. **Turmoil as a composite value**: Stored as individual sources with durations, summed for the total. This allows precise tracking of what contributes to turmoil and when sources expire.
