# Dialog Accessibility and Premium Modal Polish

## Problem Statement

`src/components/ui/dialog.tsx` wraps the native `dialog` element, but it currently exposes only `open`, `onClose`, and slot children. The wrapper does not wire the modal to its visible title, does not provide a standard close affordance, has one fixed width, does not manage long modal content, and leaves each consumer to invent dense form structure. Noble, building, G.O.S., army, recruitment, and ship dialogs can become tall enough that headers or footers disappear, which makes keyboard and small-screen use feel brittle.

This work should turn the shared dialog primitive into an accessible, polished modal surface that existing consumers can adopt without changing business logic.

## Goals

- Give every dialog a reliable accessible name through `aria-labelledby` or an explicit `aria-label`.
- Provide a consistent close button in the modal chrome, plus correct Escape handling and state synchronization with native `dialog` events.
- Add size variants so short prompts, normal forms, and dense management dialogs do not all use `max-w-lg`.
- Add scroll management that keeps the title/header and footer actions visible while only the content body scrolls.
- Preserve the existing `Dialog`, `DialogTitle`, `DialogContent`, and `DialogFooter` composition model where practical.
- Polish the modal visual structure: backdrop, panel radius, header/content/footer separation, focus ring, responsive margins, and reduced-motion-safe transitions.
- Update representative dense consumers so the shared API is proven against real content.

## Non-Goals

- Replacing native `dialog` with Radix, Headless UI, or another modal dependency.
- Rewriting page-level forms, validation, mutations, or API contracts.
- Building a global drawer/sheet primitive. This ticket is for modal dialogs only.
- Solving every page's mobile layout. Dialog internals should be responsive, but route-level responsive work remains separate.
- Adding a toast or mutation feedback system; use existing inline errors until that roadmap item is implemented.

## Current-State References

- `src/components/ui/dialog.tsx:5`
  - `DialogProps` only accepts `open`, `onClose`, and `children`.
  - `Dialog` calls `showModal()` when `open` becomes true and `close()` when `open` becomes false.
  - The `onClose` handler is attached to the native `close` event, but there is no `onCancel` handler for Escape-specific behavior.
  - The rendered `dialog` has `max-w-lg w-full rounded`, with no size variants or viewport-height cap.
  - The panel is a single `div` around arbitrary children, so long content scrolls with header/footer instead of inside a controlled body.
  - `DialogTitle` renders an `h2`, but no id is generated and `Dialog` does not set `aria-labelledby`.
  - There is no shared close button, `DialogDescription`, `DialogHeader`, or `DialogClose`.
- `src/app/game/[gameId]/realm/nobles/page.tsx:421`
  - Noble detail/edit uses one dialog for read and edit states.
  - The edit state can include identity fields, GM-only family/gender/age/status fields, skill selects, six character selects, and a backstory textarea.
  - The only visible close control in read mode is the footer `Close` button; edit mode has `Cancel` but no chrome close button.
- `src/app/game/[gameId]/realm/nobles/page.tsx:626`
  - Add Noble shows generated attributes, character details, a name input, and a reroll action. It is a good medium-height dialog for validating standard layout.
- `src/app/game/[gameId]/realm/settlements/page.tsx:694`
  - Construct Building includes building selection, conditional allotted G.O.S. selection, inline G.O.S. creation, prerequisite/status details, errors, and a footer action.
  - This is a representative dense form where the primary `Build` action should remain reachable while content scrolls.
- `src/app/game/[gameId]/realm/settlements/page.tsx:839`
  - Upgrade Building has similar conditional detail content and should use the same scrollable structure.
- `src/app/game/[gameId]/realm/gos/page.tsx:438`
  - Create G.O.S. has a checkbox list of realms inside its own `max-h-56 overflow-y-auto` container.
- `src/app/game/[gameId]/realm/gos/page.tsx:488`
  - Edit G.O.S. is a dense management dialog with many inputs and realm memberships; it should become a wide, scroll-managed dialog.
- `src/app/game/[gameId]/realm/army/page.tsx:643`
  - Create Army includes descriptive copy, several fields, and a scrollable troop picker. It should confirm nested scroll areas work inside a scroll-managed modal.
- `src/app/game/[gameId]/realm/army/page.tsx:763`
  - Recruit Troop and Construct Ship are medium forms with dynamic detail panels and should validate standard behavior.

## Proposed Dialog API

Keep the existing subcomponent pattern, but add a small context so title, description, close controls, and layout slots coordinate without manual ids in most consumers.

```tsx
type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: DialogSize;
  closeLabel?: string;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  panelClassName?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

function DialogHeader(props: HTMLAttributes<HTMLDivElement>): JSX.Element;
function DialogTitle(props: HTMLAttributes<HTMLHeadingElement>): JSX.Element;
function DialogDescription(props: HTMLAttributes<HTMLParagraphElement>): JSX.Element;
function DialogContent(props: HTMLAttributes<HTMLDivElement>): JSX.Element;
function DialogFooter(props: HTMLAttributes<HTMLDivElement>): JSX.Element;
function DialogClose(props: ButtonHTMLAttributes<HTMLButtonElement>): JSX.Element;
```

API notes:

- `DialogTitle` should receive a generated id from dialog context when the caller does not provide one. `Dialog` sets `aria-labelledby` to that id once a title is present.
- `DialogDescription` should similarly receive a generated id and register it as the default `aria-describedby`. Consumers can override with `ariaDescribedBy` when description text lives elsewhere.
- `ariaLabel` is only for rare titleless dialogs. Runtime development warning is acceptable when a dialog has neither `DialogTitle` nor `ariaLabel`.
- `size` defaults to `md` for backward compatibility. Suggested widths:
  - `sm`: `max-w-sm` for confirmations and tiny forms.
  - `md`: `max-w-lg` for current default behavior.
  - `lg`: `max-w-2xl` for building/recruitment-style forms.
  - `xl`: `max-w-4xl` for dense noble and G.O.S. editors.
  - `fullscreen`: responsive near-full viewport surface for future map or bulk editors.
- `showCloseButton` defaults to true. The button appears in the header chrome and calls `onClose`.
- `DialogClose` is available for custom placement, but normal consumers should not need it.
- `closeOnEscape` defaults to true. If a future blocking dialog needs to prevent Escape, it must set `closeOnEscape={false}` and provide an explanatory inline reason.
- `closeOnBackdrop` should default to true only if the implementation can distinguish backdrop clicks without closing on panel clicks. If there is concern about accidental dismissal in dirty forms, default to false and make consumers opt in.
- `initialFocusRef` is optional. Without it, native `showModal()` focus behavior may focus the first focusable element or the dialog itself; use the ref for dialogs where the correct first field or safest action is known.
- `className` applies to the native `dialog`; `panelClassName` applies to the visible panel.

Example target usage:

```tsx
<Dialog open={Boolean(selectedNoble)} onClose={closeNobleDetail} size="xl">
  <DialogTitle>{isEditing ? `Edit ${selectedNoble.name}` : selectedNoble.name}</DialogTitle>
  <DialogDescription>
    Review status, governance, character details, and GM notes for this noble.
  </DialogDescription>
  <DialogContent>
    ...
  </DialogContent>
  <DialogFooter>
    ...
  </DialogFooter>
</Dialog>
```

## UX Behavior

- Modal shell:
  - Center the panel within the viewport with responsive margins, for example `w-[calc(100vw-2rem)] sm:w-full`.
  - Cap panel height with `max-h-[min(90vh,calc(100vh-2rem))]`.
  - Use a flex column panel: header, scrollable content, footer.
  - Keep the footer visible for submit/cancel actions even when content is long.
  - Use `overscroll-contain` on the scrollable content area to avoid page scroll bleed.
  - Prefer `rounded-md` or existing `rounded` scale, not large pill-like corners.
- Header:
  - `DialogTitle` remains visually prominent but should fit compact chrome.
  - Close button sits top-right, has `aria-label={closeLabel}`, type `button`, and a visible focus ring.
  - The button can use a text `x` glyph because the project does not currently depend on an icon library.
- Content:
  - `DialogContent` owns vertical scroll with `overflow-y-auto`.
  - Content padding should be responsive: `px-4 py-4 sm:px-6`.
  - Existing nested scroll regions, such as realm checklists and troop lists, may remain, but they must have bounded heights lower than the modal content region.
- Footer:
  - Footer is visually separated from content with a top border or subtle shadow when content scrolls.
  - Buttons wrap on narrow widths and primary action remains reachable.
  - Mobile footer layout should stack full-width only when needed; otherwise keep current right-aligned desktop grouping.
- Motion:
  - Add only subtle opacity/scale transition if feasible with native `dialog`.
  - Respect `prefers-reduced-motion: reduce` by disabling modal entrance/exit transitions.
  - Do not rely on animation for state comprehension.

## Implementation Plan

1. Update `src/components/ui/dialog.tsx`.
   - Add `useId`, context, registration for title and description ids, and type definitions for the new props.
   - Add `DialogHeader`, `DialogDescription`, and `DialogClose` exports.
   - Keep `DialogTitle`, `DialogContent`, and `DialogFooter` exports compatible with existing imports.
   - Add size-class mapping and responsive panel/viewport-height classes.
   - Move scroll responsibility into `DialogContent`; make panel a flex column with `min-h-0`.
   - Add the standard close button in the header chrome. If consumers do not use `DialogHeader`, the component should still render close chrome aligned with the title area rather than requiring every consumer to add it manually.
   - Handle native events:
     - `onCancel`: prevent default when `closeOnEscape` is false; otherwise call `onClose`.
     - `onClose`: call `onClose` when the browser closes the dialog directly. Guard against duplicate calls caused by the controlled `open` prop closing the element.
     - Optional backdrop click: compare event target to the dialog element and call `onClose` only for true backdrop clicks.
   - When `open` becomes true, call `showModal()`, then focus `initialFocusRef.current` if provided and focusable.
   - When `open` becomes false, close the native dialog if it is still open.
   - Add body scroll lock while at least one modal is open. Use a module-level counter or a `useEffect` cleanup so nested or rapid open/close cycles do not leave `document.body.style.overflow` stuck.
2. Add component tests for the shared primitive, preferably `src/components/ui/dialog.test.tsx`.
   - Polyfill `HTMLDialogElement.prototype.showModal` and `close` in the test file if jsdom lacks native behavior.
   - Test accessible naming through `getByRole('dialog', { name: /.../ })`.
   - Test `DialogDescription` maps to accessible description.
   - Test close button, Escape/cancel event behavior, and `closeOnEscape={false}`.
   - Test `size` classes and that `DialogContent` receives scroll classes.
   - Test `initialFocusRef` moves focus after open.
3. Migrate representative consumers.
   - `src/app/game/[gameId]/realm/nobles/page.tsx`
     - Noble detail/edit: use `size="xl"` and add `DialogDescription` that changes between view/edit context.
     - Add Noble: use `size="lg"` if generated character details are tall.
   - `src/app/game/[gameId]/realm/settlements/page.tsx`
     - Construct Building: use `size="lg"` and rely on `DialogContent` scroll for long prerequisite/status content.
     - Upgrade Building: use `size="lg"`.
   - `src/app/game/[gameId]/realm/gos/page.tsx`
     - Create G.O.S.: use `size="lg"` because the realm checklist can be long.
     - Edit G.O.S.: use `size="xl"` and add a short description for what the editor changes.
   - `src/app/game/[gameId]/realm/army/page.tsx`
     - Create Army: use `size="lg"` and confirm nested troop picker remains bounded.
     - Recruit Troop and Construct Ship: use `size="lg"` for dynamic detail panels.
4. Audit remaining `Dialog` usages with `rg -n "<Dialog" src`.
   - At minimum, every usage should have a `DialogTitle`.
   - Size should be intentional: `md` can be implicit for short forms, `lg`/`xl` for dense editors.
   - Do not add page-specific modal chrome once the shared close affordance exists.
5. Run validation.
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test -- src/components/ui/dialog.test.tsx`
   - Existing page/component tests touched by migrated consumers, especially `src/app/game/[gameId]/realm/army/page.test.tsx`.

## Accessibility Requirements

- Focus:
  - Opening a modal must move focus into the dialog.
  - Closing a modal should return focus to the element that opened it when that element still exists. Store `document.activeElement` before `showModal()` and restore it after close.
  - Focus must not land behind the modal while it is open. Native `showModal()` should provide the baseline, but keyboard QA must verify it.
  - `initialFocusRef` should be used for forms where focusing the first input is the expected fastest path.
- Close affordances:
  - Every dialog has a visible close button in a predictable top-right location.
  - Escape closes by default.
  - Footer `Cancel` or `Close` buttons remain in consumers where they clarify task completion.
  - Dirty-form prevention is not part of this ticket; do not silently change existing dismissal semantics beyond adding consistent chrome.
- Labelling:
  - Every dialog must have an accessible name from `DialogTitle` or explicit `ariaLabel`.
  - `DialogTitle` generated ids must be stable for a mounted dialog.
  - Descriptive helper text should use `DialogDescription` when it explains the modal's purpose, not when it is ordinary form copy.
- Keyboard:
  - Close button, footer buttons, selects, text inputs, checkboxes, and nested scroll regions must be reachable by Tab.
  - Shift+Tab from the first focusable control should remain inside the modal.
  - Escape should trigger the same close path as the close button unless `closeOnEscape={false}`.
  - Backdrop click, if enabled, must not be the only close mechanism.
- Scroll:
  - Long content scrolls inside `DialogContent`, not behind the backdrop.
  - Header/title and footer actions remain visible at 320px wide and common laptop heights.
  - Nested scroll areas must have visible focus styles on their controls and must not trap keyboard users.
- Reduced motion:
  - Modal transitions must be disabled or nearly instant under `prefers-reduced-motion: reduce`.
  - Focus movement and close behavior must not depend on transition end events.

## Testing Strategy

- Unit/component tests with Vitest and Testing Library:
  - Render `Dialog` open with `DialogTitle`; assert `screen.getByRole('dialog', { name: /title/i })`.
  - Render with `DialogDescription`; assert the dialog has the expected accessible description.
  - Click the close button; assert `onClose` fires once.
  - Dispatch a native `cancel` event; assert Escape behavior closes by default and is prevented when `closeOnEscape={false}`.
  - Provide `initialFocusRef`; assert focus lands on that control.
  - Render long content; assert the panel/content classes include max-height and overflow boundaries.
  - Render without a title but with `ariaLabel`; assert it still has an accessible name.
- Consumer regression tests:
  - Update or add focused tests for the Create Army dialog because `src/app/game/[gameId]/realm/army/page.test.tsx` already exercises opening that dialog.
  - Add one test for a dense page dialog if feasible, such as G.O.S. edit or noble detail, to confirm migrated size props and title naming are present.
- Manual keyboard QA:
  - In nobles, open a noble detail, tab through view mode, close with Escape, reopen, switch to edit, verify footer remains visible with a long backstory.
  - In settlements, open Construct Building, enable inline G.O.S. creation, tab through all fields, verify the `Build` button remains reachable without page scroll.
  - In G.O.S. edit, tab through the realm membership checklist and confirm nested scrolling does not hide the modal footer.
  - At 320px width and a short viewport, verify title text, close button, content, and footer do not overlap.
- Screen reader spot checks:
  - Confirm the announced role is dialog/modal and the spoken name matches the visible title.
  - Confirm descriptions are announced only when useful and not duplicated for every form field.

## Acceptance Criteria

- `Dialog` has generated `aria-labelledby` support through `DialogTitle`, plus explicit `ariaLabel` fallback.
- `DialogDescription`, `DialogHeader`, and `DialogClose` are available from `src/components/ui/dialog.tsx`.
- All existing `Dialog`, `DialogTitle`, `DialogContent`, and `DialogFooter` imports continue to compile.
- Every current dialog consumer has a visible top-right close button without page-specific duplication.
- Dense representative dialogs use intentional sizes: noble detail/edit and G.O.S. edit are `xl`; construct/upgrade building and create army are at least `lg`.
- Long content scrolls inside the dialog body with header and footer visible.
- Escape, close button, and footer cancel/close actions synchronize the controlled React state exactly once per dismissal.
- Opening a dialog moves focus inside; closing restores focus to the opener when possible.
- Body/page scroll is locked while a modal is open and restored after it closes.
- Reduced-motion users do not receive meaningful modal animation.
- New component tests cover labelling, description, close controls, Escape behavior, initial focus, and scroll classes.
- `npm run typecheck`, `npm run lint`, and relevant Vitest tests pass.

## Risks and Open Questions

- Native `dialog` behavior varies in jsdom and older browsers; tests will need a small local polyfill, and implementation should avoid assumptions that only work in tests.
- Calling `onClose` from both native `close` and controlled React effects can double-fire if not guarded. The implementation should track whether the close was initiated by prop sync or user dismissal.
- Backdrop click dismissal may be undesirable for dense dirty forms. Decide whether `closeOnBackdrop` defaults to true for perceived polish or false for safer editing.
- Body scroll locking must handle multiple dialogs defensively even if the app should only show one modal at a time.
- A default header close button needs to coexist with the current title/content/footer composition. If automatic placement becomes awkward, require consumers to wrap title/description in `DialogHeader` during migration, but keep old usage compiling.
- The project currently has no icon dependency. Use a text `x` close affordance or existing CSS until an icon system exists.
