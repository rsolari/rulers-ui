# Mobile Responsiveness and Small-Screen Layout Hardening

## Problem Statement

The setup and realm workflows are functionally rich, but several page-level layouts assume desktop width. Fixed grids, single-row headers, dense card controls, and map/list pairings can overflow, compress labels, or make primary actions hard to reach on phones. This work should make GM setup and player realm management feel intentionally designed from small phones through tablets, not merely squeezed into the viewport.

## Goals

- Remove horizontal page overflow for core game routes at 320px and wider.
- Make `/game/[gameId]/setup` usable end to end on mobile, including step navigation, territory editing, settlement placement, owner assignment, review, and final submission.
- Make `/game/[gameId]/realm` usable on mobile, including the header, setup checklist, identity/status cards, realm navigation cards, territories, settlement lists, and claim-code footer.
- Establish responsive patterns in shared primitives where the current page work repeats the same fix.
- Preserve existing desktop information density and visual language.
- Keep all changes compatible with Tailwind CSS 4 and the existing local UI primitives.

## Non-Goals

- Redesigning the visual brand, typography scale, colors, or map art direction.
- Reworking game rules, API payloads, data fetching, or persistence.
- Full responsive hardening of every GM and realm subpage. This ticket can touch shared components used elsewhere, but route-specific QA should focus on setup and realm.
- Replacing `TerritoryHexMap` or `HexMap` with a new map engine.
- Adding a separate mobile app shell or device-specific route tree.

## Current-State References

- `src/app/game/[gameId]/setup/page.tsx`
  - Route: `/game/[gameId]/setup`.
  - Page shell uses `min-h-screen max-w-6xl mx-auto p-6`, which leaves limited space on 320px screens.
  - Stepper uses `mb-8 flex items-center`; four labeled step buttons plus connectors can overflow.
  - Territory cards use `grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]`, then an inner `grid grid-cols-2 gap-4`; the inner grid stays two columns below `lg`.
  - Generated map cards use a header row `flex items-center justify-between gap-4`, a map/resources split `xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]`, resource headers with nested non-wrapping flex rows, and resource form rows `grid grid-cols-[1fr_1fr_auto]`.
  - Footer actions use `flex justify-between` and nested action groups that can compress on narrow widths.
- `src/app/game/[gameId]/realm/page.tsx`
  - Route: `/game/[gameId]/realm`.
  - Page shell uses `min-h-screen p-6 max-w-6xl mx-auto`.
  - Top header uses `flex items-center justify-between mb-6`; the title block, phase badges, and Map button compete for one row.
  - Status card rows repeatedly use `flex items-center justify-between`; long labels such as `Guilds, Orders & Societies` and incident badges can collide.
  - Identity/status layout uses `grid gap-6 lg:grid-cols-[1fr_0.9fr]`.
  - Navigation cards use `grid gap-4 md:grid-cols-2 xl:grid-cols-3`, which is mostly safe but needs tap target and text wrapping checks.
  - Territory settlement rows use `flex items-center justify-between` with nested `flex items-center gap-3`, badges, and building counts.
- `src/app/game/[gameId]/layout.tsx`
  - Sticky game nav uses `h-12 flex items-center justify-between` with title, date, phase badge, and Rulebook link in a single row.
- Shared UI and map components:
  - `src/components/ui/card.tsx`: `CardHeader` and `CardContent` default to `px-6`, which is roomy on phones.
  - `src/components/ui/button.tsx`: buttons are inline by default; page code must opt into full-width mobile actions.
  - `src/components/ui/badge.tsx`: uppercase text with wide tracking can become visually noisy or wrap poorly for long labels.
  - `src/components/ui/table.tsx`: tables already get horizontal scrolling via `w-full overflow-auto`; mobile behavior should be documented and extended only if needed.
  - `src/components/map/TerritoryHexMap.tsx`: fixed SVG heights are `h-44` and `h-72`; zoom controls are small `h-6 w-6`; pointer panning only starts when zoomed.

## Proposed Responsive UX Patterns

### Headers

- Use a stacked-first header pattern:
  - Mobile: title, subtitle, badges, and actions stack vertically with `gap-3`.
  - Tablet and desktop: switch to row alignment at `sm` or `md` only when the content is known to fit.
- Badge/action groups should use `flex flex-wrap items-center gap-2`, not a single non-wrapping row.
- Primary page actions should become full-width buttons on phones and return to intrinsic width at `sm`.
- The sticky game nav should allow wrapping or split metadata into a second line on small screens. Keep a minimum tap target for `Rulebook`.

### Steppers

- Convert the setup stepper into a responsive step navigation component:
  - Mobile: horizontally scrollable `nav` or `ol` with snap points and an accessible label such as `Setup steps`.
  - Each step should have a stable min width, use `aria-current="step"` for the active step, and keep number/check state visible even if the label wraps.
  - Hide or reduce connector arrows on mobile; restore full connector treatment from `sm` or `md`.
- Preserve direct step access, including the existing special behavior where opening the map step generates map data if needed.

### Cards

- Add mobile-aware padding to card sections, either through new props on `CardHeader`/`CardContent` or local classes:
  - Mobile target: `px-4 py-4`.
  - Desktop target: existing `sm:px-6`.
- Card titles with adjacent actions should stack on mobile: title and badges first, actions below or full-width.
- Avoid card-in-card nesting. Use bordered rows or section dividers inside cards for dense groups.

### Forms

- Any page-local `grid-cols-2`, `grid-cols-3`, or custom column grid used for form inputs must become one column by default and opt into multiple columns at `sm` or `md`.
- Resource editor rows in setup should become:
  - Mobile: selected-state header, action buttons, then one-column fields.
  - `sm`: resource and size can share a row if there is room.
  - `lg`: restore dense desktop layout.
- Controls with icon-only or small square buttons, such as the random settlement name button, must remain at least `44px` by `44px`.
- Mobile action groups should use `grid grid-cols-1 gap-2 sm:flex sm:justify-end`, with full-width buttons below `sm`.

### Maps

- Wrap `TerritoryHexMap` instances in a responsive map panel that provides:
  - `min-w-0` on all grid parents.
  - Stable aspect ratio or height per context, e.g. compact maps `h-40 sm:h-44`, full maps `h-64 sm:h-72 md:h-80`.
  - Optional `max-h` on short mobile viewports so map plus sticky actions do not trap the page.
- Increase zoom control targets to at least `36px` visually and `44px` hit area on touch screens.
- Ensure tapping a selectable hex works without requiring precision; selected settlement context should remain visible near the map on mobile.
- Do not make the map itself the only way to understand placement state. Keep the row summaries and `Unplaced`/`Hex ...` labels visible.

### Tables And Lists

- Keep `Table` horizontal scrolling for true tabular data, but add visible affordance where a table is wider than the viewport:
  - Container should use `overflow-x-auto`.
  - Cells should avoid unbreakable content unless the column is intentionally scrollable.
- For dashboard status rows and settlement lists, prefer responsive list rows over tables:
  - Mobile: `grid gap-1` with label/value stacked or wrapped.
  - Desktop: `flex items-center justify-between`.
- Long names and labels must use `min-w-0`, `break-words`, and wrapping badges where needed.

### Sticky Actions

- Long setup steps should use a mobile sticky bottom action bar for Back/Next/Finish actions:
  - Mobile: `sticky bottom-0 z-20 -mx-4 border-t bg-parchment-50/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur`.
  - Desktop: return to normal in-flow footer actions.
- Sticky bars must not cover content. Add bottom padding to the step content when the sticky bar is active.
- Error states that block progression, such as unplaced settlements, should appear above the sticky action bar and near the relevant content.

## Implementation Plan

1. Add or update reusable responsive helpers.
   - Create `src/components/layout/responsive-page.tsx` or equivalent local layout helpers if no layout component exists.
   - Suggested exports: `PageShell`, `PageHeader`, `HeaderActions`, `ResponsiveActionBar`, and `ResponsiveFieldGrid`.
   - Keep helpers thin wrappers over Tailwind classes so pages remain easy to inspect.
   - Update `src/components/ui/card.tsx` only if a shared mobile padding default can be introduced without changing desktop spacing.

2. Harden the sticky game nav.
   - File: `src/app/game/[gameId]/layout.tsx`.
   - Change the inner nav container from fixed `h-12` to `min-h-12 py-2`.
   - Allow the left side to wrap with `min-w-0`, truncate only the game name if necessary, and keep metadata/badge in a wrapping group.
   - Keep the Rulebook link reachable and non-overlapping at 320px.

3. Update the setup wizard shell and stepper.
   - File: `src/app/game/[gameId]/setup/page.tsx`.
   - Change page padding to `px-4 py-5 sm:p-6` and ensure the main container has `min-w-0`.
   - Extract the stepper markup into a small local component or shared component if it will also be reused.
   - Implement horizontal scrolling/snap on mobile and `aria-current="step"`.
   - Verify direct step clicks still preserve the existing generated-map behavior.

4. Update setup territory definition cards.
   - File: `src/app/game/[gameId]/setup/page.tsx`.
   - For territory preview/edit cards, keep the outer map/form grid one column by default and two columns at `lg`.
   - Change inner territory fields from `grid grid-cols-2` to `grid gap-4 sm:grid-cols-2`.
   - Ensure description remains full width with `sm:col-span-2`.

5. Update setup generated-map cards.
   - File: `src/app/game/[gameId]/setup/page.tsx`.
   - Stack card title, type badge, and Re-roll button on mobile; use row layout from `sm`.
   - Keep the map/resources split one column below `xl`, with explicit `min-w-0` on both columns.
   - Convert each resource editor from `grid grid-cols-[1fr_1fr_auto]` to a one-column mobile layout and a denser layout at `md`.
   - Make `Place on map`, `Remove`, `Re-roll`, `Re-roll All`, and `Next` buttons full width on phones where they appear in groups.

6. Add responsive sticky actions to setup steps.
   - File: `src/app/game/[gameId]/setup/page.tsx`.
   - Replace repeated footer action rows with `ResponsiveActionBar` or a local `SetupActionBar`.
   - Use full-width mobile buttons, safe-area padding, and enough bottom spacing in step bodies.
   - Preserve disabled states for `Next: Generate Map` and `Finish Setup`.

7. Update realm dashboard shell and header.
   - File: `src/app/game/[gameId]/realm/page.tsx`.
   - Change page padding to `px-4 py-5 sm:p-6`.
   - Replace the top `flex items-center justify-between` with the stacked header pattern.
   - Make phase/year/game-phase badges wrap and keep the Map button full width on mobile, intrinsic at `sm`.
   - Ensure GM back link and claim-code footer wrap cleanly.

8. Update realm dashboard cards and lists.
   - File: `src/app/game/[gameId]/realm/page.tsx`.
   - For setup checklist footer, stack progress text and Finalize button on mobile.
   - For `Realm Status`, replace fragile `flex items-center justify-between` rows with a small `StatRow` component that stacks or wraps on mobile.
   - Add `min-w-0`, `break-words`, and wrapping badge groups for traditions, technical knowledge, incidents, and Guilds/Orders/Societies.
   - Keep the current `lg:grid-cols-[1fr_0.9fr]` identity/status layout, but ensure both columns can shrink with `min-w-0`.
   - For territory settlement rows, stack settlement name/badges and building count on mobile, restoring row layout at `sm`.

9. Harden `TerritoryHexMap` touch affordances.
   - File: `src/components/map/TerritoryHexMap.tsx`.
   - Make SVG heights configurable through className or a `heightClassName` prop, or update variant classes to be responsive.
   - Increase zoom button hit targets while preserving compact visual style.
   - Add `touch-action` deliberately: allow normal page scroll at base zoom; when zoomed, allow panning without accidental page drag.
   - Confirm selectable hexes remain keyboard and screen-reader understandable. If SVG hex keyboard support is out of scope, document that map selection has an adjacent list-based state and remains pointer/touch driven.

10. Optional follow-through for immediately adjacent workflows.
    - Files to inspect after setup/realm are stable: `src/app/game/[gameId]/create-realm/page.tsx`, `src/app/game/[gameId]/map/page.tsx`, and `src/app/game/[gameId]/gm/realm-slots/page.tsx`.
    - These use similar map/form grids and should adopt the same helper components only if the setup/realm changes introduce shared helpers.

## Testing Matrix

Run automated checks:

- `npm run typecheck`
- `npm run lint`
- `npm test`

Manual viewport checks with seeded or existing game data:

| Viewport | Purpose | Required checks |
| --- | --- | --- |
| 320x568 | smallest supported phone | no body horizontal scroll; nav wraps; setup stepper scrolls; buttons remain tappable |
| 360x740 | common small Android | setup territory forms stack; resource editor fields do not clip; sticky action bar respects safe area |
| 390x844 | common iPhone | map placement by tap works; selected settlement state is visible; realm header badges wrap |
| 430x932 | large phone | setup generated-map cards feel balanced; action groups are full width only where useful |
| 768x1024 | portrait tablet | cards use two-column layouts only where content fits; maps keep usable height |
| 1024x768 | landscape tablet | desktop-like density returns without compressed controls |
| 1280x800 | desktop baseline | no meaningful regression in spacing, density, or scanability |

Interaction checks:

- Navigate every setup step forward and backward.
- Select each setup step directly from the stepper.
- Re-roll one territory and all territories.
- Add, remove, rename, and place generated resources on a territory map.
- Attempt Finish Setup with unplaced settlements and confirm the error is visible on mobile.
- In the realm dashboard, save identity, toggle traditions, finalize setup when checklist is complete, open Map, and open each navigation card.
- Confirm `RulesChat` does not cover sticky setup actions or critical realm footer content on mobile.

## Accessibility Requirements

- No horizontal page overflow at 320px, including with long realm, territory, settlement, and Guild/Order/Society names.
- Interactive targets should be at least 44px in the touch dimension on mobile, including map zoom controls and icon-like buttons.
- Stepper uses semantic navigation, a programmatic label, and `aria-current="step"` for the active step.
- Sticky action bars appear after the step content in DOM order or have an accessible label so keyboard and screen-reader users understand the navigation context.
- Focus states remain visible for all buttons, links, selects, inputs, and map controls.
- Content order on mobile should match task order: context, current state, editable controls, then actions.
- Do not rely on hover-only disclosure for essential information. Tooltip badges can keep hover behavior, but core labels/effects needed for decisions must also be reachable through visible text, title text, or a touch-friendly alternative.
- Text remains readable at browser text zoom up to 200% without clipped controls.
- Motion or sticky behavior must not trap keyboard focus or prevent normal page scrolling.

## Acceptance Criteria

- `/game/[gameId]/setup` has no horizontal body scroll at 320px through all four steps.
- `/game/[gameId]/setup` can be completed on a phone-sized viewport without rotating the device.
- Setup stepper is accessible, scrollable on mobile, and preserves direct step navigation behavior.
- Generated-map resource rows stack cleanly on mobile and retain desktop density at larger breakpoints.
- Territory maps render at usable sizes on phones and tablets, with tappable controls and visible placement state.
- `/game/[gameId]/realm` header, status card, setup checklist, territory maps, settlement rows, navigation cards, and claim-code footer wrap without overlap at 320px.
- Mobile sticky actions do not cover validation errors, card content, browser safe areas, or `RulesChat`.
- Existing desktop layouts remain visually equivalent or improved at 1280px and wider.
- `npm run typecheck`, `npm run lint`, and `npm test` pass.

## Risks and Open Questions

- `TerritoryHexMap` currently mixes page scroll, pointer selection, zoom, and pan. Touch behavior needs careful manual testing so panning at zoom does not make the page feel stuck.
- Long generated names, realm names, and organization names may expose wrapping issues only with production-like data. Add test fixtures or manual data with intentionally long strings.
- `RulesChat` is globally rendered in `src/app/game/[gameId]/layout.tsx`; its mobile position may conflict with sticky bottom actions and needs verification.
- The setup wizard has several repeated action footers. A shared action bar is cleaner, but the implementation should avoid over-abstracting if only setup uses it after this ticket.
- It is unclear whether SVG hex selection must become fully keyboard operable in this pass. The minimum requirement is that touch users can place settlements and non-pointer users have visible state, but keyboard placement may need a follow-up interaction design.
