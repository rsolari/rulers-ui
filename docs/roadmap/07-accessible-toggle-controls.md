# Accessible Toggle Controls for Badge-Like Selections

## Problem Statement

`Badge` is a display primitive, but parts of the app use badge-shaped UI as selection controls. The current `Badge` renders a `span`, so clickable usages do not expose a control role, keyboard behavior, selected state, disabled state, or validation state to assistive technology. Replace interactive badge usage with shared semantic toggle pills and checkbox chips while preserving `Badge` for read-only status labels.

## Goals

- Keep `src/components/ui/badge.tsx` as a non-interactive status/metadata primitive.
- Add shared badge-like controls that use native `button` or `input type="checkbox"` semantics.
- Migrate all known interactive badge-like selection UI for traditions and action words.
- Make selected, disabled, and error states visible, keyboard operable, and exposed through accessible names and state.
- Preserve the app's medieval parchment/gold visual language and compact information density.
- Add regression tests and a search check that prevent future `Badge` click handlers from returning.

## Non-Goals

- Redesigning all status badges or changing display-only `Badge` colors globally.
- Reworking game rules, selection limits, API payloads, or persistence.
- Introducing a third-party component library or a new design system.
- Making SVG map hex selection keyboard accessible in this ticket.
- Replacing every bespoke button in the app. Only badge-like toggle/checkbox controls are in scope.

## Current-State References

- `src/components/ui/badge.tsx`
  - `Badge` accepts `HTMLAttributes<HTMLSpanElement>` and renders a `span`.
  - The component's broad prop type allows `onClick`, `role`, `tabIndex`, and cursor classes even though the rendered element is not an interactive control.
  - Existing variants are `default`, `gold`, `red`, `green`, `blue`, and `outline`, with compact uppercase text and rounded pill styling.
- `src/app/game/[gameId]/realm/page.tsx`
  - `toggleTradition` updates `form.traditions` with a max of 3 traditions.
  - The Realm Identity form renders each tradition as `<Badge ... onClick={...}>`.
  - Selected state is communicated through the `gold` variant only.
  - The max-of-3 limit silently ignores additional clicks instead of disabling unavailable choices.
  - The selection description relies on `title={TRADITION_DEFS[...].effect}`, which is not a sufficient accessible description.
  - `TraditionTooltipBadge` wraps a display `Badge` in a `button` only to expose a tooltip. This is not the same bug as clickable selection badges, but it should be reviewed so non-action tooltip triggers are not mistaken for toggle controls.
- `src/app/game/[gameId]/create-realm/page.tsx`
  - The Create Realm traditions list already uses native `button` elements instead of clickable `Badge`.
  - It still has bespoke chip styling, no shared API, no `aria-pressed` or checkbox state, and should migrate to the same checkbox chip pattern for consistency.
  - It already disables unselected options after 3 traditions, which should become the reference behavior.
- `src/app/game/[gameId]/gm/page.tsx`
  - The NPC realm form renders traditions as clickable `Badge` controls against `realmForm.traditions`.
  - It should match player realm behavior, including disabled options at the max count.
- `src/components/turn-actions/turn-action-card.tsx`
  - Political action words render as clickable `Badge` controls and update `draft.actionWords`.
  - These are small independent toggle buttons and are the clearest fit for an `aria-pressed` pill.
- Representative display-only badge usage should remain unchanged:
  - Header/status badges in `/game/[gameId]/realm`.
  - Status badges in `src/components/turn-actions/action-status-badge.tsx`.
  - Metadata badges in GOS, noble, army, setup, and GM pages where there is no click handler.

## Proposed Component API

Add shared controls in `src/components/ui/toggle-pill.tsx`. Keep the exports local and explicit; there is no barrel file today.

Use `TogglePill` for an independent pressed/unpressed action that behaves like a compact button. Use `CheckboxChip` for form-like multi-select options, especially tradition selection where each item is a checkbox in a group.

```tsx
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

type ChipTone = 'default' | 'gold' | 'red' | 'green' | 'blue';
type ChipSize = 'sm' | 'md';
type ChipLayout = 'pill' | 'row';

interface TogglePillProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed' | 'onChange'> {
  selected: boolean;
  onSelectedChange?: (selected: boolean) => void;
  disabled?: boolean;
  error?: boolean;
  tone?: ChipTone;
  size?: ChipSize;
}

interface CheckboxChipProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'checked' | 'defaultChecked' | 'onChange' | 'size'
  > {
  id: string;
  label: ReactNode;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  description?: ReactNode;
  meta?: ReactNode;
  disabled?: boolean;
  error?: boolean;
  tone?: ChipTone;
  size?: ChipSize;
  layout?: ChipLayout;
}

interface CheckboxChipGroupProps {
  legend: ReactNode;
  helpText?: ReactNode;
  statusText?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}
```

### `TogglePill`

- Renders a native `<button type="button">`.
- Sets `aria-pressed={selected}`.
- Calls `onSelectedChange(!selected)` from `onClick` when not disabled, while still allowing callers to pass a custom `onClick` if needed.
- Uses native `disabled` for unavailable controls.
- Applies `aria-invalid={error || undefined}` and `aria-describedby` when the caller provides error/help text.
- Defaults:
  - `tone="gold"` for selected emphasis.
  - `size="sm"` for badge-like token groups.
  - `type="button"` unless caller passes another button type.

### `CheckboxChip`

- Renders a visually styled `<label>` with a native `input type="checkbox"`.
- Keeps the checkbox in the accessibility tree. It may be visually hidden with `sr-only`, but focus must be shown on the visible chip using `peer-focus-visible`.
- Maps `selected` to `checked`.
- Calls `onSelectedChange(event.currentTarget.checked)`.
- Uses native `disabled` for disabled chips.
- Applies `aria-invalid={error || undefined}` to the checkbox.
- Supports:
  - `layout="pill"` for compact wrap groups.
  - `layout="row"` for richer options with a label, category/meta, and description.
  - `meta` for small category labels, so callers do not need to nest `Badge` inside an interactive control.
  - `description` for effects such as tradition rules text. This should replace `title` as the primary description.

### `CheckboxChipGroup`

- Renders a `<fieldset>` and visible `<legend>`.
- Provides stable ids for help, status, and error content, then wires them through `aria-describedby` on descendant chips.
- Should support visually compact legends by accepting normal React content rather than forcing a specific heading style.
- `statusText` should be useful for selection caps, for example `2 of 3 selected`.
- `error` should render visible text and be exposed via `aria-describedby`; do not rely on red border alone.

### State Mapping

- `selected`
  - `TogglePill`: `aria-pressed="true"`, selected fill/border, optional visual selected indicator.
  - `CheckboxChip`: `checked`, selected fill/border, optional visual selected indicator.
- `disabled`
  - Native `disabled`.
  - Visual opacity and `cursor-not-allowed`.
  - For max-selection limits, only disable unselected choices. Selected choices must remain enabled so the user can unselect them.
- `error`
  - Red border or ring plus visible error text near the group.
  - `aria-invalid` on the control or checkbox.
  - `aria-describedby` connects to error and help text.
- Unselected/default
  - Neutral parchment background, ink border/text, hover border darkening.
  - No selected indicator.

## Migration Plan

1. Add shared components and tests.
   - Create `src/components/ui/toggle-pill.tsx`.
   - Create `src/components/ui/toggle-pill.test.tsx`.
   - Reuse styling decisions from `Badge` and `Button`: `font-display`, compact uppercase chip labels, rounded pill shape for compact chips, `focus-visible:ring-2 focus-visible:ring-gold-400`.
2. Preserve and tighten `Badge`.
   - Keep `Badge` rendering a `span`.
   - Add a short source comment that `Badge` is display-only and interactive pills should use `TogglePill` or `CheckboxChip`.
   - After all migrations, narrow `BadgeProps` with `Omit<HTMLAttributes<HTMLSpanElement>, 'onClick' | 'onKeyDown' | 'onKeyUp' | 'role' | 'tabIndex'>` if it does not break display-only callers.
   - If narrowing is too disruptive, add a regression test or documented lint/search check instead.
3. Migrate player realm identity traditions in `src/app/game/[gameId]/realm/page.tsx`.
   - Replace the clickable `Badge` list in the Realm Identity card with `CheckboxChipGroup` and compact `CheckboxChip` children.
   - Keep `toggleTradition`, or replace it with `setTraditionSelected(tradition, selected)` so the checkbox event's desired state is authoritative.
   - Compute:
     - `selected = form.traditions.includes(option.value as Tradition)`.
     - `disabled = !selected && form.traditions.length >= 3`.
   - Pass `label={TRADITION_DEFS[value].displayName}`.
   - Pass `meta={TRADITION_DEFS[value].category}`.
   - Pass `description={TRADITION_DEFS[value].effect}` if the compact card can accommodate it. If not, include the effect in an accessible description and make the visible design intentionally compact.
   - Keep selected chips enabled even at 3 selected.
   - Remove `title` as the only effect description.
4. Migrate create-realm traditions in `src/app/game/[gameId]/create-realm/page.tsx`.
   - Replace the bespoke full-width `button` rows with `CheckboxChip layout="row"`.
   - Preserve current max-of-3 disabled behavior.
   - Preserve visible `def.displayName`, `def.category`, and `def.effect`.
   - Keep the existing `Rules: Traditions` link.
5. Migrate GM realm form traditions in `src/app/game/[gameId]/gm/page.tsx`.
   - Replace clickable `Badge` controls with the same tradition checkbox chip pattern used by player realm identity.
   - Apply the same max-of-3 disabled logic.
   - Do not change unrelated GM dashboard sections.
6. Migrate action words in `src/components/turn-actions/turn-action-card.tsx`.
   - Replace clickable `Badge` controls with `TogglePill`.
   - Use `selected={(draft.actionWords ?? []).includes(word)}` and `onSelectedChange={() => toggleActionWord(word)}`.
   - Keep `editable` behavior by passing `disabled={!editable}` if this section can render while not editable.
   - Tests should query by role `button` and assert `aria-pressed`.
7. Verify no interactive `Badge` remains.
   - Run `rg -n -U "<Badge[\\s\\S]{0,260}(onClick|onKeyDown|onKeyUp|tabIndex|role=|cursor-pointer)" src/app src/components`.
   - Inspect false positives where a nearby sibling button appears in the 260-character window.
   - Confirm any remaining matches are display-only or tooltip-only and documented.

## Accessibility Requirements

- Native controls are required.
  - Use `<button aria-pressed>` for toggle pills.
  - Use `<input type="checkbox">` for checkbox chips.
  - Do not implement `role="button"` or `role="checkbox"` on `span` or `div` for these controls.
- Keyboard behavior must come from native controls.
  - Toggle pills activate with Enter and Space.
  - Checkbox chips toggle with Space and by clicking their visible label.
  - Tab order follows DOM order and matches visual order.
  - Disabled unselected chips are skipped by keyboard focus; the group status explains why they are unavailable.
- Accessible names must be visible labels.
  - A chip named `Agrarian` should have the accessible name `Agrarian`, not only an `aria-label`.
  - Category and effect text should be exposed through visible content or `aria-describedby`.
  - `title` may remain as a supplemental hover affordance, but never as the only description.
- Group semantics are required for tradition selection.
  - Use a visible fieldset legend such as `Traditions`.
  - Provide help/status text such as `Choose up to 3 traditions. 2 of 3 selected.`
  - When the limit is reached, disabled unselected chips should be understandable from that text.
- Selected state must be programmatic.
  - `TogglePill` uses `aria-pressed`.
  - `CheckboxChip` uses native `checked`.
  - Do not communicate selected state through color alone.
- Focus must be visible.
  - Match `Button` focus treatment: gold focus ring, no hidden-only focus indicator.
  - For visually hidden checkbox inputs, the visible label must show focus using `peer-focus-visible`.
- Error handling must be accessible.
  - Error messages are visible text.
  - Controls or groups expose `aria-invalid`.
  - Error/help/status ids are included in `aria-describedby`.
- Pointer targets must remain usable.
  - Compact chips should be at least `min-h-8`.
  - Row chips should be at least `min-h-11`.
  - Do not reduce tap target size to match the current static badge height.

## Visual Polish Requirements

- The controls should look related to `Badge`, not like generic browser checkboxes.
- Compact chips:
  - `inline-flex items-center justify-center gap-1.5 rounded-full`.
  - `px-3 py-1.5 min-h-8`.
  - `font-display font-semibold uppercase tracking-[0.06em]`.
  - Neutral state: parchment/ink surface with subtle border.
  - Selected state: gold fill or gold-tinted background with a stronger gold border.
- Row chips:
  - Full width, text-left, rounded-md, border, `px-3 py-2`.
  - Label and meta align in one row when they fit; wrap cleanly when they do not.
  - Description text uses normal case, normal tracking, and `text-xs text-ink-300`.
- Disabled state:
  - Preserve text readability.
  - Use opacity plus cursor change.
  - Selected disabled controls should still visibly read as selected if a disabled selected case is introduced later.
- Error state:
  - Use red border/ring and a visible message.
  - Avoid making the chip look destructive; this is validation, not deletion.
- Layout:
  - Use `flex flex-wrap gap-2` for compact chip groups.
  - Use `space-y-1.5` or `grid gap-2` for row chip groups.
  - Long labels must wrap inside the chip or row without overflowing.
- Static category metadata should be styled inside `CheckboxChip` rather than nesting `Badge` inside the label. This prevents interactive controls from containing display pills that look like separate clickable targets.

## Testing Strategy

- Add component tests for `src/components/ui/toggle-pill.test.tsx`.
  - `TogglePill` renders as role `button` with the expected name.
  - `TogglePill` exposes `aria-pressed="true"` and `"false"`.
  - Clicking or keyboard activation calls `onSelectedChange` with the next state.
  - Disabled `TogglePill` does not call handlers.
  - `CheckboxChip` renders as role `checkbox` with the expected name.
  - `CheckboxChip` exposes checked and unchecked states through Testing Library matchers.
  - Clicking the visible label toggles the checkbox callback.
  - Disabled `CheckboxChip` is disabled and does not call handlers.
  - Error state wires `aria-invalid` and description ids.
- Update or add focused usage tests.
  - In `src/components/turn-actions/turn-action-card.test.tsx`, add coverage that action words are buttons with `aria-pressed` and can be toggled.
  - If page-level tradition tests are too heavy, extract a small `TraditionChipGroup` helper component and test it directly. Prefer this over brittle full Next route tests.
- Manual keyboard QA.
  - Tab through Create Realm tradition chips.
  - Toggle selected traditions with Space.
  - Reach 3 selected traditions and confirm only unselected chips become disabled.
  - Unselect one tradition and confirm the disabled chips re-enable.
  - Repeat in the player realm identity card and GM NPC realm form.
  - Tab through action words and confirm Enter/Space toggles pressed state.
- Regression search.
  - `rg -n -U "<Badge[\\s\\S]{0,260}(onClick|onKeyDown|onKeyUp|tabIndex|role=|cursor-pointer)" src/app src/components`
  - The final implementation should have no true interactive `Badge` matches.
- Standard verification.
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`

## Acceptance Criteria

- `Badge` remains display-only and is no longer used with click handlers, keyboard handlers, control roles, `tabIndex`, or `cursor-pointer` classes.
- A shared `TogglePill` component exists for pressed/unpressed button pills and exposes `aria-pressed`.
- A shared `CheckboxChip` component exists for selectable form chips and uses native checkbox semantics.
- Tradition selection in `src/app/game/[gameId]/realm/page.tsx`, `src/app/game/[gameId]/create-realm/page.tsx`, and `src/app/game/[gameId]/gm/page.tsx` uses checkbox chips.
- Political action words in `src/components/turn-actions/turn-action-card.tsx` use toggle pills or an explicitly justified checkbox chip pattern.
- Tradition groups visibly and programmatically communicate the max of 3 selected traditions.
- At the max tradition count, unselected choices are disabled and selected choices can still be unselected.
- Selected state is not conveyed by color alone.
- Focus is visible on every chip/toggle control.
- Error state support exists in the component API even if the first migration does not introduce new validation errors.
- The regression search for interactive `Badge` usage has no true positives.
- `npm run typecheck`, `npm run lint`, and `npm test` pass.

## Risks and Open Questions

- `BadgeProps` tightening may reveal display-only callers that pass generic span props in unexpected ways. If so, migrate those callers deliberately rather than leaving interactive props available forever.
- `TogglePill` versus `CheckboxChip` for action words is a product semantics call. `aria-pressed` is acceptable for independent toggle buttons; checkbox chips would also be defensible because action words are a multi-select field.
- The compact realm identity card may not have room to show full tradition effect text for every option. If the effect is hidden visually, it still needs an accessible description and a reliable visible way for sighted users to inspect it.
- The existing `TraditionTooltipBadge` uses a focusable button solely for tooltip display. This ticket can leave it alone if scoped tightly, but a follow-up tooltip primitive may be needed to avoid non-action buttons.
- Native disabled controls are not reachable by keyboard. This is acceptable for max-limit chips only if the group help/status text clearly explains why choices are unavailable.
- Existing tests may not have a page-level harness for Next route components that depend on router/session/fetch state. Extracting small presentational chip groups may be the least brittle way to test tradition selection behavior.
