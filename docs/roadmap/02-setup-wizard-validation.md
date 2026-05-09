# Setup Wizard Validation and Progression

## Problem Statement

The GM setup wizard at `src/app/game/[gameId]/setup/page.tsx` is visually split into territories, generated map, assignments, and review steps, but progression is not actually guarded. The stepper can jump directly to later steps, `Next: Assign Owners` remains available while generated settlements are still unplaced, and most validation feedback appears only when `handleFinish()` blocks the final save. This makes setup feel fragile: GMs can reach assignment or review with incomplete map state and only discover blockers at the end.

## Goals

- Make setup progression explicit, sequential, and recoverable.
- Prevent forward navigation into a step whose prerequisites are incomplete.
- Keep backward navigation open so GMs can revise earlier choices without losing context unnecessarily.
- Show step-level and field-level validation messages before the GM reaches review.
- Make map placement blockers visible in the generated map step and summarized in the footer.
- Keep server validation authoritative for final save, including hex ownership, duplicate placement, and setup phase checks.
- Provide enough structure that future setup steps can be added without duplicating ad hoc checks.

## Non-Goals

- Reworking the setup flow into separate routes.
- Persisting partial setup drafts to the server.
- Changing resource generation probabilities or settlement generation rules.
- Building a custom map editor.
- Changing the player realm creation flow after setup completes.
- Replacing the existing `TerritoryHexMap` renderer.

## Current-State References

- `src/app/game/[gameId]/setup/page.tsx`
  - `SetupWizard` owns all wizard state in one client component.
  - `Step` is currently `'territories' | 'map' | 'assignments' | 'review'`.
  - The stepper renders all steps as clickable buttons and calls `setStep(currentStep)` for any target step.
  - `goToMap()` calls `doGenerateMap()` and moves to `map`.
  - `doGenerateMap()` and `rebuildGeneratedMap()` regenerate resources and default placements.
  - `unplacedSettlementCount` counts resources with missing `hexKey`.
  - `handleFinish()` is the only client-side hard stop for unplaced settlements, then posts to `/api/game/${gameId}/setup`.
  - `Next: Assign Owners` currently calls `setStep('assignments')` without checking map placement completeness.
- `src/components/map/TerritoryHexMap.tsx`
  - Accepts `placements`, `selectedPlacementId`, `selectableHexIds`, and `onHexSelect`.
  - Defaults selectable hexes to `data.selectableHexIds`, which are territory land hexes.
  - Uses SVG groups for hex click targets, so the setup page must provide surrounding accessible status and controls.
- `src/lib/maps/territory-map.ts`
  - `buildCuratedTerritoryMapData()` defines `selectableHexIds`.
  - `getPreferredTerritoryHexIds()` is used by setup to auto-place generated resources where possible.
- `src/lib/game-logic/map-generation.ts`
  - `generateMap()` and `generateTerritoryResources()` create generated resources and settlements by territory type.
- `src/app/api/game/[gameId]/setup/route.ts`
  - `POST` requires GM access and `gm_world_setup`.
  - Rejects unnamed territories.
  - Rejects missing settlement `hexKey`.
  - Rejects placements outside the territory's imported land hexes.
  - Rejects duplicate settlement hexes within the same territory.
  - Imports the curated map, creates territories, player slots, NPC realms, settlements, resource sites, fortifications, and advances setup state.
- `src/app/api/game/[gameId]/setup/maps/route.ts`
  - `GET` returns curated map definitions for the wizard.
- `src/app/api/game/[gameId]/setup/route.test.ts`
  - Covers final save behavior for player slots, NPC realms, fortifications, duplicate settlement placements, and auth/setup-state failures.

## Proposed UX

### Stepper

- Treat the stepper as navigation over a validated state machine, not as free links.
- Steps:
  - `Territories`: map selected, territories loaded, required territory fields valid.
  - `Map`: resources generated and every generated settlement has a valid hex in its own territory.
  - `Assignments`: every territory has a compatible owner selection.
  - `Review`: all previous steps are valid and the payload is ready to save.
- The current and completed steps remain clickable.
- Future steps are disabled until prerequisites pass.
- A blocked future step should show a disabled style and a short tooltip/title such as `Place all settlements before assigning owners`.
- Clicking a disabled step should not move the wizard. If a custom non-disabled control is used for styling, it must set `aria-disabled="true"` and announce the blocker.
- Completed steps should be marked complete only when their validator currently passes, not merely because the GM visited them.
- If an earlier edit invalidates a later step, later steps immediately return to locked or blocked state.

### Validation Model

- Add one typed validation result per step:

```ts
type SetupStep = 'territories' | 'map' | 'assignments' | 'review';

interface StepValidation {
  isValid: boolean;
  blockers: string[];
  warnings: string[];
  fieldErrors: Record<string, string>;
}
```

- Derive validation with `useMemo()` from `selectedMapKey`, `loadingMaps`, `territories`, `generatedMap`, `assignments`, and `availableMaps`.
- Keep validation deterministic and side-effect free. Navigation handlers should consume validation results, not recompute custom checks inline.
- Use stable field error keys:
  - `territories.${index}.name`
  - `territories.${index}.type`
  - `resources.${territoryIndex}.${resourceId}.resourceType`
  - `resources.${territoryIndex}.${resourceId}.settlement.name`
  - `resources.${territoryIndex}.${resourceId}.settlement.hexKey`
  - `assignments.${index}.kind`
  - `assignments.${index}.realmName`
- The review step should render a concise blocker summary if anything becomes invalid while the GM is on review.

### Blocking States

- Territories step blocks forward navigation when:
  - curated maps are still loading
  - no map is selected
  - the selected map is not present in `availableMaps`
  - no territories are loaded
  - any territory name is blank after trimming
  - the territories array length does not match the selected map's active territory count
- Map step blocks forward navigation when:
  - generated resources are missing for any territory
  - any resource has no settlement object
  - any resource has a blank settlement name
  - any resource has no `hexKey`
  - any resource `hexKey` is not in that territory map's `selectableHexIds`
  - two resources in the same territory share a `hexKey`
  - resources outnumber selectable hexes in a territory
- Assignments step blocks forward navigation when:
  - a `Neutral` territory is assigned to anything other than `neutral`
  - a `Realm` territory has `kind: neutral`
  - assignment state is missing for any territory
  - an NPC realm name is blank after trimming, unless product decision says blank NPC names should continue using the current server default
  - owner kind is outside `player | npc | neutral`
- Review/save blocks when any prior step is invalid or the final POST fails.

### Step Actions

- Replace direct `setStep()` calls for forward movement with a single `attemptStepChange(targetStep)` or `goNext()` helper.
- Back buttons may move to the previous step without blocking.
- `goToMap()` should validate territories before regenerating. If invalid, keep the GM on territories and focus the first invalid field or the validation summary.
- Moving from map to assignments should require `mapValidation.isValid`.
- Moving from assignments to review should require `assignmentValidation.isValid`.
- Review `Finish Setup` should require `allValidation.isValid` before sending the POST.
- Re-roll actions must clearly warn that current placements for the affected territory or all territories will be replaced. Use an inline confirmation state or a browser confirm only if the existing UI does not have a dialog pattern available.

### Sticky Footer

- Add a sticky bottom footer inside `SetupWizard` so primary navigation is always visible on long map and assignment screens.
- Footer content:
  - left: current step status, for example `Step 2 of 4 - 3 settlements unplaced`
  - center or compact summary: first blocker message, with a link/button to focus the blocker summary
  - right: Back, secondary step action (`Re-roll All` only on map), and primary action
- Primary action labels:
  - Territories: `Generate Map`
  - Map: `Assign Owners`
  - Assignments: `Review Setup`
  - Review: `Finish Setup`
- Disabled primary actions should include visible text explaining why, not just disabled styling.
- Keep existing inline buttons only where they are local to a card, such as `Re-roll`, `Place on map`, `Remove`, and `Add Resource`; remove duplicate bottom-of-step next/back rows once the sticky footer is in place.

### Progress and Summaries

- Show a compact progress counter near the stepper:
  - `Territories: 12/12 named`
  - `Map: 45/48 settlements placed`
  - `Assignments: 10/12 owners assigned`
- On the map step, each territory card should show:
  - total resources
  - placed count
  - unplaced count
  - duplicate/invalid placement status if present
- On review, show a validation summary before the payload preview:
  - success state when all checks pass
  - blocker list grouped by step when anything is invalid
- When the server rejects final save, keep the GM on review unless the error can be mapped to a specific earlier step. For placement errors, navigate back to map and show the server message in the map validation summary.

## Implementation Plan

### 1. Add Wizard Validation Helpers

Create validation helpers near the top of `src/app/game/[gameId]/setup/page.tsx` first. If the helper block grows too large, extract it to `src/app/game/[gameId]/setup/setup-validation.ts` in the same feature folder.

Recommended helpers:

- `const SETUP_STEPS: Array<{ key: Step; label: string }>`
- `getStepIndex(step: Step): number`
- `validateTerritories(args): StepValidation`
- `validateMapPlacements(args): StepValidation`
- `validateAssignments(args): StepValidation`
- `combineValidation(validations): StepValidation`
- `getFirstInvalidStep(validations): Step`
- `canNavigateToStep(targetStep, currentStep, validations): { allowed: boolean; reason?: string }`
- `getStepProgress(step, state): { completed: number; total: number; label: string }`

Keep helpers pure so they can be tested without rendering the full wizard.

### 2. Refactor SetupWizard Derived State

In `src/app/game/[gameId]/setup/page.tsx`:

- Replace `unplacedSettlementCount` as the only blocker signal with richer derived validation:
  - `territoryValidation`
  - `mapValidation`
  - `assignmentValidation`
  - `reviewValidation`
  - `validationByStep`
  - `allSetupValid`
- Keep `unplacedSettlementCount` if useful for labels, but derive it from the same map validation inputs.
- Add refs or ids for step validation summaries:
  - `territories-validation-summary`
  - `map-validation-summary`
  - `assignments-validation-summary`
  - `review-validation-summary`
- Track `attemptedStep` or `hasAttemptedSubmit` so validation messages can be shown proactively after a blocked action without flooding the first paint.

### 3. Replace Free Stepper Navigation

In the current stepper block:

- Use `SETUP_STEPS` instead of recreating labels inside the render map.
- Compute each step's status from validation:
  - active
  - complete
  - blocked
  - locked
- Use a real `<button type="button">` with `disabled` for locked future steps where possible.
- For blocked future steps that should explain a reason, use `title`, `aria-describedby`, and adjacent visually readable text in the validation summary.
- Route all clicks through `attemptStepChange(currentStep)`.
- Do not call `setStep(currentStep)` directly from the stepper.

### 4. Guard Step Transitions

Replace these direct transitions:

- `goToMap()` should call territory validation before `doGenerateMap()`.
- Map footer primary action should replace `setStep('assignments')`.
- Assignment footer primary action should replace `setStep('review')`.
- Stepper clicks should use the same guard path.
- `handleFinish()` should call `reviewValidation` before POSTing.

Behavior:

- If a transition is blocked, set a visible error scoped to the current step and focus that step's validation summary.
- If a target step is valid and generated map is empty when moving to map, call `doGenerateMap()` once.
- If moving backward, do not validate or regenerate.

### 5. Add Field-Level Feedback

In `src/app/game/[gameId]/setup/page.tsx`:

- Territory name inputs:
  - trim for validation, preserve typed value
  - pass `aria-invalid` when invalid
  - add an inline `<p id=...>` error below the field
- Resource rows:
  - show missing placement next to the placement summary, not only at the top
  - show invalid or duplicate hex errors next to `Place on map`
  - mark the active unplaced resource clearly
- Settlement name inputs:
  - validate non-empty after trimming
  - add `aria-invalid` and inline error text
- Assignment owner controls:
  - prevent impossible owner kinds in the option list
  - show inline error if existing stale state is incompatible after territory type changes
- NPC realm name:
  - decide whether blank is invalid or should use the current server fallback. If invalid, enforce in the UI and update acceptance tests accordingly.

Avoid broad changes to `src/components/ui/Input` and `src/components/ui/Select` unless needed. The current components forward arbitrary input/select props, so setup can pass `id`, `aria-invalid`, `aria-describedby`, and `className` locally.

### 6. Improve Map Placement Controls

In the map step:

- Add a territory-level placement summary at the top of each card.
- Disable `Next: Assign Owners` through footer validation until every generated settlement is placed on a valid unique hex.
- When `addResourceToTerritory()` cannot auto-place because no selectable hex remains, add the resource as unplaced and immediately show a blocker on that row.
- When `assignPlacementHex()` displaces another resource from the same hex, keep the current swap behavior but announce which settlement became unplaced in the validation summary.
- If the GM removes the active resource, set the next active resource to the first unplaced resource if one exists, otherwise the first resource.
- Add a `Place next unplaced` action per territory if it improves ergonomics; this can simply select the first resource without `hexKey`.

### 7. Sticky Footer Component

Keep this local unless reused elsewhere:

- `SetupWizardFooter`
  - props: `step`, `stepIndex`, `stepCount`, `validation`, `progress`, `saving`, `onBack`, `onPrimary`, `onSecondary`
  - renders sticky container with responsive wrapping
  - hides Back on the first step
  - shows `Re-roll All` as secondary only on map step

The footer should use existing `Button` variants and avoid nested card styling.

### 8. Server Validation Alignment

Keep `src/app/api/game/[gameId]/setup/route.ts` authoritative. Add or preserve tests for:

- missing settlement `hexKey`
- settlement placed outside the territory land hexes
- duplicate settlement hexes in one territory
- blank territory names
- invalid owner kind if route currently accepts stale payloads too loosely

If the client adds stricter NPC realm name requirements, either:

- add matching server validation, or
- document that blank NPC names intentionally use the server default `${territory.name} NPC Realm`.

### 9. Tests

Add focused tests rather than relying only on manual checks:

- Unit test extracted validation helpers if they are moved to `setup-validation.ts`.
- Add `src/app/game/[gameId]/setup/page.test.tsx` if feasible with existing Testing Library setup:
  - stepper cannot jump to assignments before map validation passes
  - map primary action remains blocked with an unplaced settlement
  - placing every generated settlement enables assignments
  - changing a territory type or selected map invalidates later steps
  - review finish does not POST when validation fails
- Extend `src/app/api/game/[gameId]/setup/route.test.ts` for any new server validation rules.

Run:

- `npm test -- setup`
- `npm run typecheck`
- `npm run lint`

## Edge Cases

### Map Loading and Selection

- `availableMaps` can load as an empty array. The wizard should show an empty state and keep all forward actions disabled.
- Changing `selectedMapKey` should rebuild territories, assignments, generated resources, active placement ids, and validation state together.
- If `selectedMapKey` no longer exists in `availableMaps`, block progression and show a map selection error.
- If map definitions load slowly, the footer primary action should be disabled with `Loading maps...`.

### Map Generation and Re-Rolls

- `generateTerritoryResources()` can return more resources than the number of selectable hexes because luxury rolls can cascade into multiple resources. This should be represented as a blocker: the GM must remove resources or choose a different map/territory configuration before progressing.
- `Re-roll All` replaces generated resources and placements for every territory. It should reset active placement ids and invalidate later steps if any settlement becomes unplaced.
- Territory-level `Re-roll` replaces only that territory's resources and placements. It should not reset assignments for other territories.
- Editing a territory type from `Realm` to `Neutral` or back regenerates resources today through `updateTerritory()`. The new UX should warn that resources and placements for that territory may change, then invalidate map/review as needed.

### Unplaced Resources and Settlements

- Every resource creates a starting settlement for setup purposes, so validation should talk about settlements rather than abstract resources when blocking hex placement.
- Removing a resource removes its settlement requirement.
- Adding a resource should create a settlement with a valid default name, but it may still be unplaced.
- Blank settlement names should block map progression and final save.
- Duplicate placement in the same territory should block map progression even though the current UI normally swaps duplicates away.
- Duplicate coordinate keys across different territories are invalid if the coordinate is not selectable in that territory; server-side imported hex validation remains the source of truth.

### Ownership

- Neutral territories should force `kind: neutral` and disable other owner options.
- Realm territories should allow only `player` or `npc`.
- If a territory changes to Neutral, any stale player/NPC assignment should be replaced with neutral before review.
- If a territory changes from Neutral to Realm, assignment should default to player and be revalidated.
- Player slot display names can remain optional.
- NPC realm names need a product decision:
  - Option A: required in client and server for explicit setup clarity.
  - Option B: optional, preserving current server fallback naming.

### Review and Save

- Review must not be reachable unless territories, map placements, and assignments are valid.
- Review should still re-run validation on render because earlier state can change through back navigation.
- `Finish Setup` should be disabled while saving and while validation fails.
- If the final POST fails with a placement-related error, show the error and navigate to map.
- If the final POST fails with an auth or setup-state error, stay on review and show the server message.
- Prevent double submit by keeping `saving` true until the request settles and by disabling all footer actions that would mutate setup during save.

## Accessibility Requirements

- Stepper should expose current step with `aria-current="step"`.
- Disabled or locked steps should be actual disabled buttons where possible.
- Each step should have one validation summary region with `role="alert"` or `aria-live="polite"` after a blocked action.
- Primary action blockers must be visible text, not only color or disabled state.
- Inputs/selects with errors should set `aria-invalid="true"` and `aria-describedby` to the inline error id.
- Focus should move to the validation summary when a forward action is blocked.
- After successful step navigation, focus should move to the new step heading.
- The SVG map is not a sufficient keyboard placement interface. Keep row-level `Place on map` buttons keyboard accessible, and consider adding a coordinate select fallback for the active settlement if keyboard-only placement is required for acceptance.
- Color-coded complete/error states must also include text or icons with accessible labels.

## Responsiveness Requirements

- Stepper should wrap cleanly on mobile and avoid horizontal overflow.
- Sticky footer should stack into two rows on small screens:
  - status/blocker row
  - action row
- Map step cards should keep the map above the resource list on narrow screens.
- Resource row controls should collapse from three columns to one column on mobile.
- Long territory, settlement, and realm names should wrap without overlapping badges or buttons.
- Footer should respect safe-area insets with `pb-[env(safe-area-inset-bottom)]` or equivalent padding.

## Acceptance Criteria

- The GM cannot navigate from Territories to Map until a valid curated map is selected and every territory has a non-blank name.
- The GM cannot navigate from Map to Assignments while any generated settlement is unplaced, duplicated, invalid for its territory, or missing a name.
- The GM cannot navigate from Assignments to Review while any ownership state is incompatible with the territory type.
- The stepper no longer allows jumping directly to Assignments or Review from an incomplete earlier step.
- Backward navigation remains available from later steps.
- The sticky footer appears on all steps and shows current progress plus the primary next action.
- Disabled primary actions include a visible reason.
- Map territory cards show placed/unplaced counts.
- Review shows a passing validation summary before `Finish Setup` is enabled.
- `Finish Setup` does not POST when client validation fails.
- Server-side setup tests still cover missing, duplicate, and out-of-territory settlement placement.
- New validation helper or page tests cover blocked progression for unplaced settlements and locked stepper navigation.
- `npm test -- setup`, `npm run typecheck`, and `npm run lint` pass.

## Risks and Open Questions

- The current setup page is already large. Adding validation, footer, and field messages in place may make it harder to maintain; extracting helpers is recommended once the first behavior is proven.
- Re-rolling resources after the GM has made manual placement edits can be destructive. The implementation needs a clear confirmation or undo story before making re-roll easier to discover.
- NPC realm name strictness needs a product decision because the server currently supports a fallback.
- Keyboard-only map placement may need a non-SVG fallback control if accessibility acceptance requires full placement without pointer input.
- Client validation can drift from server validation. Keep server tests authoritative and prefer shared pure validation helpers where client/server rules overlap.
