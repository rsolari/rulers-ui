# TODO

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
