# Action and Event Lifecycle

This section describes how Actions and Events flow through the digital implementation of Rulers, from creation to resolution.

## Turn Structure

Each turn represents one Season. A full game year is four turns: Spring, Summer, Autumn, Winter. The turn has two phases:

1. **Submission Phase** — Players draft and submit their actions.
2. **Resolution Phase** — The N.O. (Game Master) resolves political actions and advances the turn.

## Action Lifecycle

### 1. Draft

Players create actions during the Submission Phase. Each action starts in `draft` status and can be freely edited or deleted. Players can create:

- **Political Actions** using up to 6 Action Words total per turn.
- **Financial Actions** for building, recruiting, ship construction, tax changes, or spending.

### 2. Submit

When the player submits their turn report, all draft actions transition to `submitted` status. Financial actions that involve construction or recruitment are automatically executed at this point — buildings begin construction and troops begin recruitment immediately.

### 3. Execute (Resolution)

The N.O. resolves submitted political actions by:

- Rolling dice for Noble skill checks (Reason or Cunning).
- Setting the **outcome** (success, failure, partial, or void).
- Writing a **resolution summary** describing what happened narratively.

### 4. Turn Advancement

When the N.O. advances the turn:

- All remaining submitted actions are marked as `executed`.
- The economy resolves: taxes collected, upkeep paid, construction and recruitment timers tick down.
- The game advances to the next season.
- Any auto-generated events (turmoil reviews, winter unrest) are created for the new turn.

### Action Outcomes

| Outcome   | Meaning |
|-----------|---------|
| `success` | The action succeeded as intended. |
| `failure` | The action failed to achieve its goal. |
| `partial` | The action partially succeeded, with limited or mixed results. |
| `void`    | The action was nullified or made irrelevant by circumstances. |

## Event Lifecycle

Events are occurrences that affect a Realm, created either by the N.O. or automatically by the system.

### Event Types

- **GM Event** (`gm_event`) — Custom events created by the N.O. to introduce narrative developments, crises, or opportunities.
- **Turmoil Review** (`turmoil_review`) — Auto-generated when a Realm's turmoil level is high enough to warrant review. Created at the start of each new turn.
- **Winter Unrest** (`winter_unrest`) — Auto-generated at the start of Winter if a Realm has dangerously high turmoil, representing popular discontent.

### Event Statuses

| Status      | Meaning |
|-------------|---------|
| `open`      | The event is active and awaiting resolution by the N.O. |
| `resolved`  | The N.O. has resolved the event with a narrative outcome. |
| `dismissed` | The event was dismissed without effect. |

### Event Resolution

The N.O. resolves events by:

- Writing a **resolution** describing the outcome.
- Optionally applying **mechanical effects** (economic modifiers, turmoil changes).
- Setting the status to `resolved` or `dismissed`.

## What Players See

### Current Turn

- **Open events** affecting their Realm (turmoil reviews, winter unrest, GM events).
- Their draft and submitted actions for the current turn.

### Last Turn Results

After the turn advances, players see a summary of the previous turn:

- **Events** that occurred and their resolutions.
- **Action results** showing the outcome, any dice rolls, and the N.O.'s resolution summary for each action.

### Turn History

A chronological log of all past turns, showing both actions and events for each turn, ordered from most recent to oldest.

## What the N.O. Sees

The N.O. has a Turn Review panel showing:

- Submission progress across all Realms.
- All submitted actions for each Realm, with tools to set outcomes, roll dice, and write resolution summaries.
- Events affecting each Realm.
- The Advance Turn button to move to the next season once resolution is complete.
