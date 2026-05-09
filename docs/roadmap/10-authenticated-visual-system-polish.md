# Authenticated Visual System and Premium Polish

## Problem Statement

The landing page establishes a strong Rulers art direction with a full-bleed kingdom image, restrained heraldic iconography, and purposeful card treatment. Authenticated routes do not carry that same discipline. Realm, setup, GM, and related management pages rely on repeated parchment cards, dense uppercase badges, text-only `+` actions, plain empty messages, and mixed hierarchy. The result is functional but uneven: important decisions compete with metadata, routine status chips look as loud as primary state, and long GM/player workflows feel assembled from local one-off styles rather than a coherent application system.

This spec defines a premium but practical authenticated visual system. The goal is not to add more medieval ornament. The goal is to make the logged-in app clearer, more polished, more scannable, and more consistent while preserving the existing Rulers tone.

## Goals

- Establish authenticated-app primitives for page shells, headers, cards, status, empty states, stats, and icon actions.
- Reduce visual noise from overused parchment cards, gold borders, and badge clusters.
- Improve hierarchy across realm, setup, GM, and G.O.S. management pages.
- Replace text `+` button prefixes and decorative glyph buttons with consistent icons and accessible labels.
- Make empty, loading, warning, and success states feel designed rather than like fallback paragraphs.
- Keep dense game-management workflows efficient for repeat use by GMs and players.
- Preserve the landing page art direction and existing palette, but use it with more restraint inside the app.
- Keep implementation incremental so page changes can land without a full app rewrite.

## Non-Goals

- Redesigning the landing page or hero experience.
- Changing game rules, route behavior, API payloads, or persistence.
- Replacing map renderers, SVG terrain assets, or `TerritoryHexMap`.
- Introducing heavy animation, decorative background art, or new illustration systems for every screen.
- Solving every mobile issue in this ticket; this visual system should support responsive work, but route-specific mobile hardening belongs with the mobile roadmap.
- Reworking information architecture, navigation destinations, or the setup state machine beyond the visual patterns needed here.

## Current-State References

- `src/app/globals.css`
  - Lines 6-137 define the core parchment, ink, gold, heraldic color, type, spacing, radius, shadow, and motion tokens.
  - Lines 214-241 set the authenticated app body background and heading defaults globally.
  - Lines 244-347 define semantic type classes, but authenticated pages mostly use ad hoc Tailwind text classes instead.
  - Lines 349-359 define `.rulers-border` and `.medieval-border`; these are used broadly as heavy ornamental containers instead of reserved emphasis.
- `src/components/ui/button.tsx`
  - Variants are text-first and support `default`, `accent`, `outline`, `outline-hero`, `ghost`, and `destructive`.
  - There is no first-class icon slot, icon-only size, loading state, or visible affordance beyond text.
  - The current focus ring is present, but all variants share similar rounded text-button treatment.
- `src/components/ui/card.tsx`
  - `default` and `gold` both use illuminated 2px borders and inset shadows.
  - `hero` and `hero-gold` are appropriate for landing overlays but should not be the model for every authenticated panel.
  - `CardHeader`/`CardContent` have fixed roomy padding, which pushes dense dashboards toward many large repeated panels.
- `src/components/ui/badge.tsx`
  - Badges are uppercase, widely tracked, pill-shaped, and visually strong.
  - The same component represents metadata, action state, warnings, ownership, category labels, and counts, creating noisy clusters.
- `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, `src/components/ui/tabs.tsx`, and `src/components/ui/table.tsx`
  - Inputs/selects have consistent labels and borders.
  - Tabs are local state only and are not currently used as a broader authenticated navigation pattern.
  - Tables already have horizontal overflow handling but surrounding dashboard rows are mostly custom flex layouts.
- `src/app/game/[gameId]/layout.tsx`
  - Lines 39-66 render a sticky game nav with a game name, season/year, phase badge, and Rulebook link in a single compact row.
  - This nav is functional, but visually disconnected from the richer page shell the app needs.
- `src/app/game/[gameId]/realm/page.tsx`
  - Lines 283-295 show a page header where title, phase badges, and Map action all compete on one row.
  - Lines 298-353 render the setup checklist as a gold card with custom check circles and plain progress text.
  - Lines 441-566 render `Realm Status` as a dense stack of flex rows and badges.
  - Lines 580-615 render six navigation cards that are all visually equivalent despite different importance.
  - Lines 617-664 render territories and settlements with nested `medieval-border` rows and small plain empty text.
- `src/app/game/[gameId]/setup/page.tsx`
  - Lines 552-611 render setup title, description, and stepper with local pill buttons and inline SVG connector arrows.
  - Lines 652-684 render territory edit cards as repeated default cards.
  - Lines 720-849 render generated map cards, resource rows, text actions, one-off active state styling, a dice glyph button, and `+ Add Resource`.
- `src/app/game/[gameId]/gm/page.tsx`
  - Lines 620-635 show a dense header with many badges.
  - Lines 640-689 render metric summary cards with similar weight to deeper management panels.
  - Lines 692-723 render a broad action bar with text-only Refresh, Map, and Export actions.
  - Lines 728-806 render player slot and setup progress cards with nested bordered rows and badge clusters.
  - Lines 812-930 begin the Realms management section with `+ Add NPC Realm`, inline form panels, selectable badges, and plain empty states.
- `src/app/game/[gameId]/realm/gos/page.tsx`
  - Lines 337-435 show a typical authenticated subpage: text-only back action, `+ New`, badges for organization metadata, a plain empty paragraph, and inline assets disclosure.
  - Lines 621-630 show asset summary panels using `medieval-border` and a non-existent-looking `bg-parchment-800/30` class pattern that should be normalized.
- Related status and empty-state surfaces:
  - `src/components/turn-actions/action-status-badge.tsx` maps turn state directly to `Badge`.
  - `src/components/technical-knowledge/technical-knowledge-badges.tsx` returns a plain paragraph for empty state.
  - `src/components/turmoil/turmoil-summary-card.tsx` uses a default card plus badges for projected status.
  - `src/components/turn-actions/player-turn-report-panel.tsx` uses plain paragraphs for loading and empty states, and text-only `Add Political Action` / `Add Financial Action` buttons.

## Proposed Design System Changes

### Typography

- Add authenticated-app type utilities in `src/app/globals.css` that sit below the landing-scale classes:
  - `.t-app-title`: display font, 2rem desktop, 1.625rem mobile, tight line height, no oversized hero treatment.
  - `.t-app-section`: serif section heading, 1.375rem to 1.625rem.
  - `.t-app-label`: display font, uppercase, smaller tracking than badges.
  - `.t-app-body`: body font at 1rem or 1.0625rem for dense application copy.
  - `.t-app-meta`: 0.875rem metadata copy with ink-400/ink-500 tone.
- Use display font for app title, labels, and compact controls only. Use the serif/body fonts for readable dashboard content.
- Stop using `text-3xl font-bold` directly for every authenticated page title. Page headers should use `t-app-title`, section headings should use `t-app-section`, and card titles should remain smaller.
- Keep letter spacing at readable levels inside dense controls. Badges and labels should not all use `tracking-[0.16em]` or higher.

### Spacing and Layout

- Add thin layout primitives:
  - `src/components/layout/app-page.tsx`: `AppPage`, `AppPageHeader`, `AppPageActions`, `AppSection`, and `AppSectionHeader`.
  - `AppPage` should encapsulate `min-h-screen`, `max-w-6xl`, responsive page padding, and `min-w-0`.
  - `AppPageHeader` should stack title, subtitle, status, and actions by default and move to row layout at wider breakpoints.
- Use the existing 8px spacing scale from `globals.css`, but reduce page-level repetition:
  - Page header to first section: 24px.
  - Sections: 24px to 32px.
  - Dense rows inside cards: 8px to 12px.
  - Card padding: `px-4 py-4 sm:px-5` for dense panels; reserve `px-6` for narrative or form-heavy panels.
- Avoid card-in-card nesting. Use rows, section dividers, and grouped lists inside a single panel.

### Cards and Panels

- Update `src/components/ui/card.tsx` with authenticated variants:
  - `panel`: default authenticated card, 1px warm border, subtle parchment background, low shadow.
  - `emphasis`: reserved for important setup blockers, current-turn calls to action, or highlighted summary state.
  - `stat`: compact metric panel with consistent label/value layout.
  - `interactive`: card-like link row with hover/focus treatment and optional icon.
  - Keep `hero` and `hero-gold` for landing/hero overlays.
- De-emphasize `gold` as the default way to signal importance. Gold should mean current, recommended, active, or critical-to-progress.
- Replace local `medieval-border` row wrappers with a shared `ListRow` or `SurfaceRow` pattern using 1px borders and predictable padding.
- Card titles with actions should use a common header layout that wraps cleanly and keeps actions visually secondary unless they are the primary task.

### Buttons and Icons

- Add icon support to `Button`:
  - `leftIcon?: ReactNode`
  - `rightIcon?: ReactNode`
  - `iconOnly?: boolean`
  - `loading?: boolean`
  - size `icon` for square icon buttons
- Add `lucide-react` as the utility icon dependency unless another icon package lands first. Recommended icons:
  - `Plus`, `RefreshCw`, `Map`, `Download`, `Edit`, `Trash2`, `ChevronLeft`, `ChevronRight`, `Eye`, `EyeOff`, `Dice5`, `CheckCircle2`, `Circle`, `AlertTriangle`, `Info`, `Users`, `Coins`, `Shield`, `Landmark`.
- Continue using `public/icons/*` only for brand/heraldic moments, not utility actions.
- Replace visible `+` prefixes in app buttons:
  - `+ New` -> `Plus` icon + `New`
  - `+ Add NPC Realm` -> `Plus` icon + `Add NPC Realm`
  - `+ Add Resource`, `+ Recruit Troops`, `+ Build`, `+ New Family`, etc. -> icon button pattern.
- Replace standalone glyph controls:
  - Setup random settlement name button `&#x2684;` should become a `Dice5` icon button with `aria-label="Generate random settlement name"`.
  - Star capital badge `&#9733; Capital` should become a status/metadata pill with an icon or accessible label.
- Icon-only buttons must include `aria-label`, visible focus state, and a tooltip or title where the meaning is not obvious.

### Status Surfaces

- Split `Badge` responsibilities:
  - `Badge`: low-emphasis metadata tag.
  - `StatusPill`: semantic status with optional dot/icon and tone.
  - `CountPill`: compact numeric count.
  - `Alert`: block-level warning/error/success/info surface.
- Add tone names rather than using only color names:
  - `neutral`, `active`, `success`, `warning`, `danger`, `info`, `muted`.
- Status should not rely on color alone. Include text, icons, or shape where state matters.
- Use `Alert` for blockers such as unplaced setup resources, failed loads, and setup requirements instead of red paragraphs.
- Use `ProgressChecklist` for setup readiness rather than bespoke check circles.
- Use `StatRow` and `StatGrid` for treasury, income, food, turmoil, slots, and turn status. This will reduce repeated `flex items-center justify-between` rows.

### Empty, Loading, and Error States

- Add `src/components/ui/empty-state.tsx`:
  - Props: `icon`, `title`, `description`, `action`, `tone`, `compact`.
  - Compact mode should fit inside card sections and disclosure panels.
- Add `src/components/ui/loading-state.tsx` or a shared `LoadingState` export:
  - Consistent centered loading text/spinner/skeleton for full-page and card contexts.
- Replace plain empty paragraphs in realm, GM, G.O.S., nobles, settlements, and turn panels with `EmptyState`.
- Empty states should answer three questions:
  - What is missing?
  - Why does it matter?
  - What action can the user take now?
- Do not over-decorate empty states. A small utility icon, concise title, one sentence, and one action is enough.

### Density

- Define two density modes in components where needed:
  - `default`: forms, onboarding, setup decisions.
  - `compact`: GM dashboard lists, status rows, turn history, asset lists.
- Avoid turning every datum into a badge. Prefer label/value rows for stable metadata and reserve badges for categorical or stateful labels.
- On dense pages, put the primary workflow first, then secondary metadata in quieter rows.
- Use `details` disclosures and section dividers where data is useful but not first-scan critical.

### Color Use

- Keep parchment/ink/gold as the brand base, but introduce quieter authenticated surface tokens:
  - `--surface-page`
  - `--surface-panel`
  - `--surface-panel-muted`
  - `--surface-row`
  - `--surface-row-hover`
  - `--border-subtle`
  - `--border-accent-soft`
- Add semantic status background/border/text tokens:
  - `--status-success-bg`, `--status-success-border`, `--status-success-fg`
  - same for warning, danger, info, neutral.
- Reserve strong gold fills and 2px gold borders for:
  - active step/current turn
  - ready/complete calls to action
  - high-priority setup or GM action
- Use realm colors as small accents only where tied to ownership or map context. Do not use realm colors for broad page backgrounds without contrast checks.

## Implementation Plan

### 1. Add Authenticated Tokens And Layout Helpers

Files:

- `src/app/globals.css`
- `src/components/layout/app-page.tsx`

Changes:

- Add authenticated surface, border, and semantic status tokens under the existing root token block.
- Add `.t-app-*` type utilities after the existing semantic typography classes.
- Create `AppPage`, `AppPageHeader`, `AppPageActions`, `AppSection`, and `AppSectionHeader`.
- Keep helpers as thin wrappers around classes. They should not fetch data or encode game concepts.
- Document intended usage in component props or small comments only where needed.

Sequencing note: land this first so page work can converge on shared primitives instead of inventing another local shell.

### 2. Upgrade Shared UI Primitives

Files:

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- New `src/components/ui/status-pill.tsx`
- New `src/components/ui/alert.tsx`
- New `src/components/ui/empty-state.tsx`
- New `src/components/ui/stat-row.tsx`
- Optional new `src/components/ui/list-row.tsx`

Changes:

- Add button icon slots, icon-only size, and loading support.
- Add authenticated card variants while preserving existing `default`, `gold`, `hero`, and `hero-gold` until pages migrate.
- Soften `Badge` default styling or add `size="sm" | "md"` and `emphasis="low" | "medium"`.
- Add `StatusPill` for state, `Alert` for block feedback, `EmptyState` for empty/loading-adjacent no-data panels, and `StatRow` for label/value rows.
- Keep exports tree-shakable and simple. Avoid a large design-system barrel unless the repo already adopts that pattern.
- Add focused unit/render tests for the new components only if current test patterns make that cheap.

### 3. Normalize Authenticated Nav

File:

- `src/app/game/[gameId]/layout.tsx`

Changes:

- Replace the single-row sticky nav with an app-nav surface that uses `min-h-12`, responsive wrapping, and quieter status treatment.
- Use `StatusPill` for turn phase.
- Add an icon to `Rulebook` only if it improves recognition without crowding.
- Keep `RulesChat` unchanged, but verify the new nav layering does not interfere with it.

### 4. Refresh Realm Dashboard

File:

- `src/app/game/[gameId]/realm/page.tsx`

Changes:

- Wrap the page in `AppPage`.
- Replace the top header with `AppPageHeader`:
  - title: realm name
  - subtitle: game name
  - status group: turn phase, year/season, game phase
  - action: Map button with `Map` icon
- Replace setup checklist card with:
  - `Card variant="emphasis"` only while setup has incomplete required items.
  - `ProgressChecklist` or local `ChecklistRow` using `CheckCircle2`/`Circle`.
  - `Alert` for blocked finalization when needed.
- Replace `Realm Status` flex rows with `StatRow`/`StatGrid`.
- Replace tradition and technical knowledge empty paragraphs with compact `EmptyState` or quieter metadata copy.
- Replace six plain navigation cards with `interactive` cards that include icons, optional counts, and short subtitles:
  - Ruler & Nobles
  - Guilds, Orders & Societies
  - Settlements & Buildings
  - Armies & Troops
  - Treasury
  - Trade & Resources
- Replace territory/settlement `medieval-border` wrappers with `ListRow` sections and compact status pills.
- Keep the claim-code footer, but move it into a quiet `Alert` or subdued footer row so it feels intentional.

### 5. Refresh Setup Wizard Visual Shell

File:

- `src/app/game/[gameId]/setup/page.tsx`

Changes:

- Wrap with `AppPage`.
- Replace the local title/description with `AppPageHeader`.
- Extract the stepper into a local `SetupStepper` or shared `Stepper` component:
  - use `StatusPill` or compact step state
  - replace inline SVG connector arrows with icon components
  - show active/current state without overusing gold fills
- Replace red text errors with `Alert tone="danger"` and warnings with `Alert tone="warning"`.
- Update generated map cards:
  - use `Card variant="panel"` for normal territory cards
  - use `StatusPill` for territory type and placement state
  - replace random-name glyph button with `Button size="icon"` and `Dice5`
  - replace `+ Add Resource` with `Plus` icon button
  - make active placement rows use a consistent selected row surface, not `rounded-xl bg-gold-500/8`
- Reserve `emphasis` styling for the current step's primary blocker or next action, not every realm territory.

### 6. Refresh GM Dashboard High-Impact Areas

File:

- `src/app/game/[gameId]/gm/page.tsx`

Changes:

- Wrap with `AppPage` and `AppPageHeader`.
- Turn the header badge cluster into quieter status pills grouped under the title.
- Convert the three setup summary cards into `StatGrid` cards with consistent labels, values, and secondary text.
- Replace action bar text-only buttons:
  - Refresh with `RefreshCw`
  - Map with `Map`
  - Export Database with `Download`
  - Add NPC Realm with `Plus`
- Replace player slot rows and setup progress rows with `ListRow`, `StatusPill`, and `CountPill`.
- Replace the inline realm form shell using `medieval-border` with `Card variant="panel"` or a `FormPanel`.
- Convert selectable traditions and technical knowledge from clickable badges to a token/checkbox control pattern with selected and focus states.
- Use `EmptyState` for no player slots, no claimed slots, no realms, no territories, no families, no nobles, and no G.O.S.
- Do not attempt to redesign every deep GM subpanel in one pass. Apply shared primitives to repeated patterns first, then migrate the longest management sections as follow-up patches.

### 7. Refresh G.O.S. And Adjacent Realm Subpages

Files:

- `src/app/game/[gameId]/realm/gos/page.tsx`
- Opportunistic follow-up pages: `realm/army/page.tsx`, `realm/nobles/page.tsx`, `realm/settlements/page.tsx`, `realm/treasury/page.tsx`, `realm/trade/page.tsx`

Changes:

- Use `AppPageHeader` with a real back action and `Plus` icon for creation.
- Convert organization metadata from badge clusters to a mix of `StatusPill`, metadata rows, and compact count pills.
- Replace `View Assets & Income` / `Hide Assets` with `Eye` / `EyeOff` icon treatment.
- Replace plain no-realm/no-G.O.S./no-assets paragraphs with `EmptyState`.
- Normalize asset summary panels currently using `medieval-border` and incorrect-looking parchment class names.
- Migrate adjacent realm subpages only where they share the exact plus-button, empty-state, or badge-density issues. Do not expand scope into rule or data changes.

### 8. Clean Up Legacy Patterns

Files:

- `src/app/game/[gameId]/**`
- `src/components/**`

Changes:

- Search for visible plus-button text:
  - `rg "\\+ (Add|New|Create)|>\\+" src/app src/components`
  - replace app actions with icon-supported `Button`.
- Search for plain empty paragraphs:
  - `rg "No .* yet|No .* assigned|No .* recorded|has no|Choose a realm" src/app src/components`
  - replace user-facing no-data states with `EmptyState` where the page has room.
- Search for `medieval-border` usage:
  - keep it only for intentionally ornamental brand moments
  - replace dense row/card usage with `panel`, `ListRow`, or `SurfaceRow`
- Search for badge overuse in headers and dense rows:
  - move stable metadata to text rows
  - keep badges/status pills for actual state and category.

### 9. Verification

Run:

- `npm run typecheck`
- `npm run lint`
- `npm test`

Manual route checks:

- `/game/[gameId]/realm`
- `/game/[gameId]/setup`
- `/game/[gameId]/gm`
- `/game/[gameId]/realm/gos`
- one dense realm subpage such as `realm/army`, `realm/nobles`, or `realm/settlements`

## Accessibility and Responsiveness Requirements

- All new icon-only controls must have `aria-label` and visible focus states.
- Icon + text buttons must keep text visible for primary actions; icon-only is for compact utility actions only.
- Minimum touch target should be 44px in at least one dimension for mobile utility controls.
- Do not encode important state by color alone. Use text, icons, or both.
- Page headings must preserve a logical `h1` -> `h2` -> `h3` order after introducing `AppPageHeader` and section components.
- Empty states and alerts must be reachable in normal DOM order near the content they describe.
- Alerts that appear after failed actions should be focusable or announced with appropriate `role="alert"` where the user needs immediate feedback.
- Badge/status text must remain readable at 200% browser text zoom.
- Header status groups and action bars must wrap without overlap at 320px.
- Long realm, settlement, territory, noble family, and G.O.S. names must use `min-w-0`, wrapping, and `break-words` where needed.
- Interactive card links must have visible hover and keyboard focus treatment.
- Reduced motion users should not receive decorative or persistent motion; any loading spinner should be non-essential and paired with text.

## Visual QA Checklist

Check each target route at 320px, 390px, 768px, 1024px, and 1280px:

- Page header hierarchy is clear: title, subtitle/context, status, actions.
- Primary action is visually identifiable within three seconds.
- Header badges/status pills wrap and do not dominate the title.
- Card borders are not all equally heavy; gold/emphasis is rare and meaningful.
- Dense rows align labels and values consistently.
- Empty states have a title, short explanation, and relevant action when action is possible.
- Loading and error states use shared surfaces rather than loose paragraphs.
- Text `+` prefixes are gone from app buttons.
- Utility actions use icons consistently and remain accessible by label.
- Badge clusters are reduced; stable metadata appears as rows or quiet text.
- Territory/map panels still look connected to the Rulers world without extra decoration.
- There is no horizontal body scroll or overlapping text at the tested widths.
- Focus rings are visible on buttons, links, inputs, selects, tabs, and disclosure controls.
- Color contrast passes for status text, muted metadata, disabled controls, and warning/error surfaces.
- The landing page remains visually unchanged except for shared primitive changes that are intentionally compatible.

## Acceptance Criteria

- Authenticated routes have shared page/header/card/status/empty-state primitives in use on at least realm, setup, GM, and G.O.S. pages.
- `Button` supports icon-leading, icon-trailing, icon-only, and loading states; visible plus signs are no longer used as action icons in migrated pages.
- `Badge` is no longer the only status surface. Semantic `StatusPill`, `Alert`, and `EmptyState` components exist and are used in migrated pages.
- Realm dashboard uses a clearer page header, quieter status rows, polished setup checklist, interactive navigation cards, and designed empty states.
- Setup wizard uses a consistent app shell, polished stepper, alerts for blockers, icon utility actions, and normalized resource row states.
- GM dashboard high-impact header, summary, actions, player slots, setup progress, and realm management sections use the new visual system.
- G.O.S. page uses the new header/action/empty-state/status patterns.
- Gold borders/fills are reserved for active, ready, warning, or primary-progress moments and are no longer the default treatment for most cards.
- No migrated page introduces horizontal overflow at 320px.
- `npm run typecheck`, `npm run lint`, and `npm test` pass after implementation.

## Risks and Open Questions

- This overlaps with app shell and mobile roadmap work. If shared layout helpers land in another ticket first, reuse them rather than creating duplicate wrappers.
- Adding `lucide-react` is the cleanest utility icon path, but it is a new dependency. If dependency additions are undesirable, create a small local icon set and document the tradeoff.
- GM dashboard is very large. A single pass should prioritize shared primitives and the highest-impact repeated patterns instead of trying to perfect every subpanel.
- Existing `Badge` usage may encode behavior through string variants. Migrating to semantic tones needs careful review so state meaning does not change.
- Some realm colors may not meet contrast requirements on parchment. Ownership accents need contrast checks before broadening their use.
- `medieval-border` may still be appropriate for a few brand moments. The implementation should remove casual overuse without deleting the class or breaking landing/rules styling.
- If other agents modify docs or adjacent UI files while implementation happens, keep this ticket scoped to the visual system and avoid reverting unrelated work.
