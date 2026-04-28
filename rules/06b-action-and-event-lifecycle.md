# Action and Event Lifecycle

This section describes how Actions and Events flow through the digital implementation of Rulers.

## Action Lifecycle

Actions move through this lifecycle:

`draft -> submitted -> resolved + event spawned`

or, for multi-turn work:

`draft -> submitted -> pending -> resolved + event spawned`

Players draft actions during the Submission Phase. When they submit their turn report, draft actions become `submitted`. The N.O. resolves submitted Political Actions by choosing an outcome, recording any dice rolls, adding any Reason or Cunning modifier from the assigned Noble, and writing a resolution summary. Resolving an action always creates at least one linked Event.

## Multi-Turn Actions

Some actions remain `pending` across turns. Construction, recruitment, ship building, and long-running Political Actions all use the same model.

Example: a Construction action is submitted. The building row is created immediately with a construction countdown, and the action becomes `pending`. Each turn advancement reduces the countdown. When the countdown reaches 0, the action becomes `resolved` and a `construction_complete` Event is created for the owning Realm.

Pending Political Actions from prior turns do not count against the 6 Action Word limit for a new turn. Only new Political Actions submitted in the current turn count.

## Event Audiences

Events are visible only to Realms in their audience list. Action resolutions default to the acting Realm, plus the target Realm if the action has one. The N.O. may choose a smaller or larger audience.

If different Realms should see different framing, the N.O. creates separate Events linked to the same action. For example, the acting Realm might see the mechanical result while the target Realm sees a rumor or warning.

## Event Types

- `action_resolution` records the outcome of a resolved action.
- `construction_complete`, `recruit_complete`, and `ship_complete` record finished multi-turn financial work.
- `cross_realm_effect` records effects involving more than one Realm.
- `gm_event` records an ad-hoc Event created by the N.O.
- `turmoil_review` and `winter_unrest` are system-created unrest Events.

## GM Ad-Hoc Events

The N.O. may create Events with no underlying action. These Events still have an audience, status, title, description, and optional resolution. They are used for famine, rumors, disasters, opportunities, and other developments that should appear in a Realm's Event Log.
