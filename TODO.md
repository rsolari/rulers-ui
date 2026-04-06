# TODO

- Clarify `TechnicalKnowledge` modeling. The rulebook requires specific technical knowledge for some buildings and troop paths, but the current schema stores it as an untyped realm-level JSON list. The validator currently treats any local or traded entry as satisfying the generic `TechnicalKnowledge` prerequisite. Add typed knowledge keys plus source tracking so imported knowledge can be validated and costed precisely.

- Clarify how `Food` should gate `Stables`. The rulebook lists Food as a prerequisite, but the current backend models food as derived seasonal economy state rather than an explicit construction input. The validator currently records this as an ambiguity note instead of blocking construction. Add an explicit build-time food access/input rule so this prerequisite can be enforced without inventing behavior.

- Add a canonical relationship model for trade tie-breaks. The trade resolver now stops and surfaces a GM hook when multiple import sources are tied on both quality and tax, because the rulebook says the final tie-break should be based on inter-realm relationship and the backend still has no authoritative relation graph. Add realm-to-realm relationship state and feed it into trade resolution so equal-quality/equal-price monopolies can resolve automatically when the data exists.
