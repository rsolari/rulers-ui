# TODO

- There should be a way for the GM to create events for realms (not necessarily tied to an action). Events should also show in a “news feed” for players and GM. GM can use this for turmoil, flavor, disasters, wars, messages, and ingame events like sporting events

- GM should be able to advance the turn

- In-progress buildings should take up a slot in a settlement

## User Feedback

- **BUG: Army creation broken.** Clicking "New Army," naming the army, then clicking "Create Army" does nothing. Investigate the army creation flow in `/src/app/game/[gameId]/realm/army/page.tsx` and the POST endpoint at `/src/app/api/game/[gameId]/armies/route.ts`. Check for missing form validation, silent API errors, or state not resetting after submission. Fix whatever is preventing army creation from completing.

- **Noble creation: generate-then-name flow.** Currently the player types a name and stats are randomly generated, which can produce mismatches (e.g., naming someone "Charlemagne" and getting a woman). Change the noble creation UI so that clicking "Generate Noble" first randomly determines gender, age, and personality, displays them to the player, then auto-generates a name appropriate for the gender. The player can accept or re-roll the name. Update the dialog in `/src/app/game/[gameId]/realm/nobles/page.tsx` and the name generation logic in `/src/lib/tables.ts` (add a `generateNobleName(gender)` function if one doesn't exist).

- **Noble editing.** There is no way to edit a noble after creation. Add an edit flow to the noble detail view in `/src/app/game/[gameId]/realm/nobles/page.tsx`. The player should be able to change the noble's name. The GM should be able to change any field. Add a PATCH endpoint at `/src/app/api/game/[gameId]/nobles/[nobleId]/route.ts`.

- **Settlement governor assignment UI.** Settlements have a `governingNobleId` field and a `NobleAssignmentSelect` component exists, but users report difficulty seeing/changing which noble governs a settlement. Make the governor field more prominent in the settlement list and detail views at `/src/app/game/[gameId]/realm/settlements/page.tsx`. Ensure the assignment dropdown is clearly visible and functional.

- **Build and recruit actions should resolve without GM.** Currently, building construction and troop recruitment require manual GM intervention to actually create the entities. These are financial actions that should resolve automatically. When a player submits a "build" action, the system should validate prerequisites and treasury, deduct costs, and create the building (with construction turns remaining). Same for "recruit" — validate settlement recruitment cap, deduct costs, and create the troop. Update the action resolution logic and wire it into the existing building/troop creation APIs.

- **Add buildings to settlements (UX).** Users can't figure out how to add buildings to a settlement. Currently building creation is GM-only via API with no player-facing UI. Add a "Build" button to the settlement detail view that opens a dialog showing available building types (filtered by prerequisites the settlement meets). This is related to the "build actions should auto-resolve" item above — the UI should let the player initiate construction, which deducts costs and starts the build timer.

- **Map zoom level too low.** The maximum zoom factor is 3.5× in `/src/components/map/HexMap.tsx` (line 17, `MAX_ZOOM_FACTOR = 3.5`). Increase it to allow users to see map details more clearly. Try 6.0 or 8.0. Test that the hex rendering, labels, and icons remain crisp at higher zoom levels. Also consider increasing the base `HEX_SIZE` (currently 24) if hexes are too small even at max zoom.

- **Streamline realm creation for GM.** The current flow requires: (1) GM creates territory and places settlements, (2) player creates realm, (3) GM assigns territory to realm. Consolidate the GM steps so the GM can pre-configure everything before handing off. Add a GM-side "Prepare Realm Slot" flow that lets the GM create a territory, place/name settlements, and pre-assign it to a player slot — so when the player creates their realm (choosing name, government, traditions), the territory is auto-assigned. Look at `/src/app/game/[gameId]/create-realm/page.tsx` and `/src/app/api/game/[gameId]/realms/create-player-realm/route.ts`.

- **Settlement/territory transfer for captured settlements.** When a settlement is captured in war, the GM needs a way to transfer it (and optionally its parent territory) to the conquering realm. Add a GM-only "Transfer Settlement" action to the settlement detail view and a corresponding API endpoint. The transfer should update `realmId` on the settlement (and territory if applicable), and the map colors should update to reflect the new ownership. Consider adding a turmoil event to both the losing and gaining realms.

- **Multinational guilds/orders/societies.** GOS are currently realm-scoped (`realmId` in schema). Add support for GOS that span multiple realms — e.g., a religion or trade guild present across several kingdoms. Add a `gosRealms` junction table (gosId, realmId) to model many-to-many membership. Update the GOS schema, API, and UI to support multi-realm GOS. The GM should be able to create a GOS and assign it to multiple realms. Each realm's GOS page should show shared GOS alongside realm-specific ones.

- **GOS tracking: buildings, settlements, military, nobles, income, treasury.** The GOS schema has `treasury` and `leaderId` but lacks full tracking. Expand the GOS detail view to show: buildings owned by the GOS (via `ownerGosId` in buildings table), settlements where they operate, military units (via `gosId` in troops/armies), affiliated nobles, and an income/expense breakdown. The schema relations mostly exist — this is primarily a UI task. Build a GOS detail page at `/src/app/game/[gameId]/realm/gos/[gosId]/page.tsx` that aggregates this data.

- **Realm flags on map.** Add colored flag icons over settlements and armies on the map, matching the realm's color. The realm colors are currently assigned from a hardcoded palette in `HexMap.tsx` (lines 18-31, `REALM_COLORS`). Persist the color assignment in the realm schema (add a `color` field to the `realms` table). Render a small flag/banner SVG icon at each settlement hex and army position, filled with the realm's color. Keep it simple — a colored triangle or pennant shape, not full heraldry.

- **Expand warnings on the ledger.** The treasury page at `/src/app/game/[gameId]/realm/treasury/page.tsx` shows a "Warnings" card from `projection.warnings`, but users say it doesn't elaborate. Expand warnings to cover: low treasury (can't afford next season's maintenance), food shortages, unpaid noble estates, recruitment cap reached, buildings under construction, and any unresolved GM events. Update the economy projection logic to generate these warnings and display them with actionable detail (e.g., "Treasury will be negative by -50g next season — consider raising taxes or reducing maintenance").

- **GM dice roller for noble actions.** A dice library exists at `/src/lib/dice.ts` with `rollD6`, `countSuccesses`, etc. Add a GM-facing dice roller UI for resolving noble actions. The GM selects a noble mission/action, the app shows the relevant skill and modifiers, the GM clicks "Roll," and the results are displayed and logged. The roll result should be visible to the player who initiated the mission (via the events/news feed once that exists). Add a dice roll component and wire it into the noble action flow.

- **Database export/backup.** Add a GM-only "Export Database" button that downloads the SQLite database file as a backup. Add an API endpoint at `/src/app/api/game/[gameId]/export/route.ts` that reads the database file and returns it as a downloadable blob. Add the button to the GM dashboard. This protects against data loss when the app is updated or tweaked.

- **Turmoil: GM manual assignment.** Turmoil should be manually assigned by the GM, not auto-generated by events. Ensure the GM dashboard has a way to add/remove turmoil points for any realm. If there's already a turmoil field on the realm, add a simple +/- control to the GM realm management view. If turmoil is currently auto-applied anywhere (e.g., from food shortages or levy tax), keep that behavior but also allow GM overrides.

- Clarify `TechnicalKnowledge` modeling. The rulebook requires specific technical knowledge for some buildings and troop paths, but the current schema stores it as an untyped realm-level JSON list. The validator currently treats any local or traded entry as satisfying the generic `TechnicalKnowledge` prerequisite. Add typed knowledge keys plus source tracking so imported knowledge can be validated and costed precisely.

- Clarify how `Food` should gate `Stables`. The rulebook lists Food as a prerequisite, but the current backend models food as derived seasonal economy state rather than an explicit construction input. The validator currently records this as an ambiguity note instead of blocking construction. Add an explicit build-time food access/input rule so this prerequisite can be enforced without inventing behavior.

- Add a canonical relationship model for trade tie-breaks. The trade resolver now stops and surfaces a GM hook when multiple import sources are tied on both quality and tax, because the rulebook says the final tie-break should be based on inter-realm relationship and the backend still has no authoritative relation graph. Add realm-to-realm relationship state and feed it into trade resolution so equal-quality/equal-price monopolies can resolve automatically when the data exists.

## Tradition Effects — Gaps

- **Diplomatic tradition (+1 Diplomacy rolls):** No diplomacy system exists yet. Needs a diplomacy roll mechanic where this bonus can be applied.
- **Sporting tradition (annual events reduce turmoil):** Turmoil reduction from annual events is not tracked or applied during turn advance.
- **Outrider tradition (+1 Message speed):** No message system exists. Needs a message/courier mechanic where this speed bonus can be applied.
- **Militaristic tradition (+1 Military rolls):** No combat roll system exists yet. Needs a military roll mechanic where this bonus can be applied.
- **Horde tradition (+2 morale for Basic troops):** No morale system exists. Needs troop morale tracking and application during combat.
- **Chivalric tradition (+2 morale for Elite troops):** No morale system exists. Needs troop morale tracking and application during combat.
- **TheImmortals tradition (+3 combat, +2 morale for one troop):** No combat or morale system exists. Needs both combat resolution and morale mechanics.
- **Architectural tradition (faster construction):** Bonus is not applied to build times during turn advance. Wire the tradition check into construction duration calculation.
- **EncouragedLabour tradition (faster construction):** Bonus is not applied to build times during turn advance. Wire the tradition check into construction duration calculation.
- **MastersOfVillainy tradition (+1 Subterfuge):** No subterfuge system exists. Needs a subterfuge mechanic where this bonus can be applied.
- **Pathfinder tradition (+1 movement speed):** Calculated but not actually consumed during turn advance movement resolution.

## GOS Income — Edge Cases

- **Guild monopoly competition:** The code exempts the first guild-owned building from maintenance, but there's no mechanic for guilds competing across realms or losing monopoly rights. Clarify whether guilds can lose monopoly status and what triggers it.

## Edge Cases & Ambiguities

- **Levy tax auto-revert duration:** The code reverts Levy→Tribute after 4 seasons, but the rules don't explicitly state a duration. The code infers this from "generates 10 Turmoil per season" as a temporary measure. Confirm whether 4 seasons is the intended duration or if it should be configurable/different.
- **Food shortage turmoil escalation beyond 3 seasons:** The code implements 25% at 2 consecutive seasons and 50% at 3+, but doesn't continue the geometric progression. Clarify what happens at 4, 5, 6+ consecutive shortage seasons — should turmoil keep doubling?
- **Building payment priority when treasury is insufficient:** The code pays maintenance in settlement/building ID order. The rules don't specify priority. Decide whether military buildings should take precedence, whether players should choose, or if current behavior is acceptable.
- **Trade route blockade mechanics:** The rules mention blockades stop trade, but the code has no blockade state. Define what happens to industries producing combined products (base + imported luxury ingredients) when a blockade is active mid-season.
- **Multiple tax changes per turn:** The code takes only the last tax change action from a report. Clarify whether multiple tax changes in a single turn are legal or if only the final one should apply.
- **Traded TechnicalKnowledge surcharge:** The code applies a 25% surcharge when using traded TechnicalKnowledge (for Gunsmith/CannonFoundry), but the rules only mention the surcharge for "resources accessed through trade," not knowledge specifically. Confirm whether knowledge should carry the surcharge.
- **Castle/Fort food consumption in settlements:** Fort needs 1 food, Castle needs 2, but rules say this applies to "standalone" forts/castles. The code checks `locationType === 'territory'`. Clarify what happens when a castle is inside a settlement — does it still consume food?
- **Settlement defense rating composition:** The code defines `FORTIFICATION_DEFENCE` values but never combines them with settlement base defense (Village 0, Town 2, City 4) for actual combat resolution. Implement combined defense calculation when combat system is built.
- **Noble estate costs when unpaid:** Noble upkeep is calculated, but there's no consequence for when a realm can't afford noble estates. Define consequences — do nobles become disloyal? Leave? Reduce loyalty?
- **Recruitment limits not enforced via API:** The per-season cap (4/6/8 by settlement size) is defined in constants but never enforced during troop creation via the API. Add server-side validation to prevent exceeding recruitment caps.
