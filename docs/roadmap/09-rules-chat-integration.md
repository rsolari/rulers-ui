# Rules Chat Integration and Collision-Aware Help Surface

## Problem Statement

`RulesChat` is useful, but it currently owns a fixed bottom-right launcher and panel that are mounted over every game and rulebook workflow. Because the chat is visually detached from the app shell and does not know about sticky actions, map controls, mobile safe areas, or future navigation surfaces, it can obscure important controls and feel like an external widget instead of first-class help.

## Goals

- Move rules chat entry and placement into the app shell/help surface while keeping one-click access from game and rulebook routes.
- Preserve the existing streaming rules-advisor behavior, markdown rendering, clear-chat action, and concise rulebook-only answer contract.
- Split chat state, launcher UI, panel UI, and collision placement so future shells can reuse the same help surface.
- Prevent the minimized control and open panel from covering sticky action bars, critical footer controls, or mobile safe areas.
- Persist conversation and UI state across route changes and browser refreshes in a bounded, privacy-conscious way.
- Make loading, streaming, error, retry, and abort states visible and accessible.
- Keep the implementation compatible with the current layouts and with the planned authenticated app shell in `docs/roadmap/01-app-shell-navigation.md`.

## Non-Goals

- Replacing the `/api/rules-chat` OpenRouter integration or changing the model selection in this ticket.
- Teaching the rules advisor about live game state, player-specific strategy, or database records.
- Adding a new third-party floating UI, popover, dialog, or icon dependency.
- Redesigning the full rulebook, GM dashboard, setup wizard, or mobile layout beyond the collision hooks needed by this surface.
- Building a general customer-support chat system with unread counts, notifications, user accounts, or multi-agent routing.
- Making rulebook citations perfect. The current system prompt requirement to cite chapters should remain, but citation-quality improvements are a separate rules-content task.

## Current-State References

- `src/components/rules-chat.tsx`
  - Client component that owns `open`, `input`, scroll refs, textarea focus, launcher button, panel chrome, message list, markdown rendering, error block, and composer.
  - Renders a fixed `bottom-6 right-6 z-50` circular button and a fixed `bottom-20 right-6 z-50` `400px` by `500px` panel.
  - Uses unicode glyphs for open/close state and does not expose placement, minimized state, or collision inputs.
  - Focuses the textarea when opened and scrolls messages to the bottom when messages change.
- `src/hooks/use-rules-chat.ts`
  - Owns volatile in-memory `messages`, `isStreaming`, `error`, and an `AbortController`.
  - Sends `POST /api/rules-chat` with prior user/assistant messages, streams plain text from `response.body`, and appends chunks into the last assistant message.
  - Calls `readErrorMessage` for non-OK responses and removes an empty assistant placeholder on failure.
  - `clearChat()` aborts in-flight work and resets memory state, but nothing persists across remounts or refreshes.
- `src/app/api/rules-chat/route.ts`
  - Requires `OPENROUTER_API_KEY`.
  - Validates a non-empty `messages` array, keeps the last `MAX_TURNS = 40`, builds the system prompt from `src/lib/rules-chat.ts`, and streams text/plain chunks back to the client.
  - Returns JSON error payloads for missing config, invalid input, and upstream failures.
- `src/lib/rules-chat.ts`
  - Builds the system prompt by reading every file returned from `getRuleChapters()` and instructs the advisor to answer only from the official rulebook.
- `src/app/game/[gameId]/layout.tsx`
  - Client layout fetches game metadata, renders a sticky game nav except on the join page, and globally renders `<RulesChat />` after `{children}`.
  - Current nav has a `Rulebook` link but no integrated help entry point or reserved help placement.
- `src/app/rules/layout.tsx`
  - Server layout renders the rulebook header, sidebar, main content, and globally renders `<RulesChat />`.
  - The rulebook sidebar is sticky on desktop; the chat panel currently floats independently over the content/sidebar layout.
- `src/app/globals.css`
  - Contains `.rules-content` prose styles and compact `.rules-chat-content` overrides used by assistant markdown bubbles.
- Existing UI primitives:
  - `src/components/ui/button.tsx` should be reused for text/icon buttons.
  - `src/components/ui/dialog.tsx` can inform focus and overlay behavior, but the help panel likely needs a custom responsive dock/sheet because it stays mounted across route content.

## Proposed UX

### Help Entry Point

- Replace the global bottom-right launcher as the primary entry point with a shell-owned `Rules Advisor` help control.
- Game routes:
  - In the current layout, add the control to the right side of the sticky game nav next to `Rulebook`.
  - After the app shell roadmap lands, move the same control into the shell utility area so it remains visible beside role/context/primary action controls.
  - Use a compact `?` or `Rules` button at narrow widths and `Rules Advisor` text at wider widths. Do not add a new icon package just for this.
- Rulebook routes:
  - Add the control to the rulebook header nav next to `Rulebook`/`Play`.
  - Because users are already in rules content, label the control `Ask Advisor` on desktop and `Ask` on mobile.
- The entry point should expose active state:
  - Closed: normal shell utility button.
  - Open: active visual state, `aria-expanded="true"`, and `aria-controls` pointing at the panel.
  - Streaming while minimized/closed: small inline status text or dot on the entry point with accessible text `Rules advisor is answering`.
  - Error while minimized/closed: error indicator with accessible text `Rules advisor has an error`.

### Panel Placement

- Move fixed positioning out of `RulesChat` and into a new shell-owned surface.
- Desktop and wide tablet (`lg` and up):
  - Prefer a right-side dock anchored below the sticky header: `top: var(--help-top-offset)`, `right: var(--help-safe-right)`, `bottom: var(--help-safe-bottom)`.
  - Use a stable width of about `24rem` to `26rem`, with `max-width: calc(100vw - 2rem)`.
  - On very wide app-shell layouts, reserve inline space for the open dock when feasible so dense page controls are not covered. This can be done by applying `--rules-help-panel-width` to the shell content wrapper.
  - On current layouts without a full shell content wrapper, allow overlay placement but obey collision insets and keep the panel visually attached to the nav help control.
- Medium viewports:
  - Use a right drawer over the page with a light backdrop only when the panel would otherwise cover central controls.
  - Keep the drawer dismissible with Escape, outside click/tap, and the close button.
- Rulebook desktop:
  - Dock the panel to the right of the content area when viewport width allows.
  - If a future right rail is introduced for rulebook page metadata, the rules advisor should share that help rail instead of creating a competing overlay.

### Minimized, Open, and Closed States

- `closed`: panel is not visible; conversation is retained; shell entry point remains available.
- `open`: panel is visible, composer is focused only when the user opens it by keyboard/pointer and `prefers-reduced-motion` does not require skipping focus animation.
- `minimized`: panel collapses back to the shell entry point while preserving the stream and draft input.
  - Do not keep a persistent bottom-right bubble on desktop if the shell control is visible.
  - If a route temporarily hides the shell header, show a small collision-aware `Rules` tab attached to the nearest safe viewport edge.
- Closing and minimizing do not clear chat history. Only `Clear` removes messages and persisted history.
- Route changes under the same layout keep provider state alive. Full layout changes restore the last persisted conversation and UI preference.

### Collision Handling

- Introduce a lightweight collision contract rather than hard-coding every route:
  - Elements that should not be covered add `data-rules-help-avoid="bottom"`, `data-rules-help-avoid="right"`, or both.
  - The help surface measures visible avoid elements with `ResizeObserver` plus scroll/resize listeners and sets CSS variables:
    - `--rules-help-safe-bottom`
    - `--rules-help-safe-right`
    - `--rules-help-top-offset`
  - The panel and any fallback quick tab consume those variables in their fixed positioning.
- Initial avoid targets:
  - Existing or future mobile sticky setup action bars from `docs/roadmap/06-mobile-responsiveness.md`.
  - Any sticky footer or command bar introduced by the app shell.
  - Map controls or legends only if they occupy the same right/bottom region as the help surface.
- Collision rules:
  - Bottom avoid elements push the minimized fallback tab and the panel bottom above the element plus `env(safe-area-inset-bottom)`.
  - Right avoid elements push the panel inward only when they intersect the panel's vertical span.
  - If computed safe space leaves less than `20rem` height or `19rem` width, switch to mobile sheet placement.
  - Do not attempt pixel-perfect collision with every card. The contract is for sticky/fixed surfaces and known critical controls.
- Add a debug-only warning in development when an open help panel still overlaps a registered avoid element by more than a small tolerance.

### Mobile Behavior

- At widths below `md`, the shell/header help button is the only persistent launcher.
- Opening the advisor displays a sheet/dialog instead of a floating panel:
  - `fixed inset-x-0 bottom-0 top-[var(--rules-help-top-offset)]`
  - Safe-area-aware bottom padding.
  - Header row with title, streaming/error status, minimize/close, and clear action when messages exist.
  - Message list gets the remaining height and the composer stays pinned to the sheet bottom.
- Underlying sticky actions should not remain visually interactive while the sheet is open. Use a backdrop or full-height sheet treatment and restore focus to the help button when dismissed.
- The sheet must work at `320px` width without horizontal overflow. Composer actions can stack or use an icon/short `Ask` button, but the textarea remains the primary target.
- On mobile rulebook pages, opening the advisor should not permanently hide the current rule chapter; closing returns to the same scroll position.

## Implementation Plan

### 1. Split the Existing Component

Refactor `src/components/rules-chat.tsx` into smaller pieces. Suggested file layout:

- `src/components/rules-chat/rules-chat-panel.tsx`
  - Presentational panel with header, message list, error/status area, and composer.
  - Props include `messages`, `isStreaming`, `error`, `draft`, `onDraftChange`, `onSubmit`, `onClear`, `onAbort`, `onClose`, `placement`, and ids for accessibility.
  - Keeps markdown rendering with `ReactMarkdown`, `remarkGfm`, and the existing `.rules-chat-content` class.
- `src/components/rules-chat/rules-chat-message-list.tsx`
  - Optional extraction if the panel file gets too dense.
  - Owns scroll-to-bottom behavior and should avoid forcing smooth scroll when `prefers-reduced-motion` is enabled.
- `src/components/rules-chat/rules-chat-composer.tsx`
  - Owns textarea keyboard handling, disabled states, and submit button layout.
- `src/components/rules-chat/index.ts`
  - Re-exports the public components.

Keep a temporary `src/components/rules-chat.tsx` compatibility export if needed so existing imports can migrate in one pass.

### 2. Add a Help Surface Provider

Create `src/components/help/rules-help-surface.tsx`.

Responsibilities:

- Own `openState: 'closed' | 'open' | 'minimized'`.
- Own the draft input so minimizing does not discard unsent text.
- Use `useRulesChat()` for conversation state.
- Render the shell entry button when requested, or expose `useRulesHelp()` so the layout can render its own button.
- Render `RulesChatPanel` in the correct desktop dock, tablet drawer, or mobile sheet placement.
- Apply collision CSS variables from the collision hook.
- Restore focus to the trigger on close/minimize.
- Close on Escape when focus is inside the panel.

Suggested API:

```ts
export function RulesHelpProvider({ children, surfaceId }: RulesHelpProviderProps): JSX.Element;
export function RulesHelpButton(props: RulesHelpButtonProps): JSX.Element;
export function RulesHelpPanel(): JSX.Element | null;
export function useRulesHelp(): {
  state: 'closed' | 'open' | 'minimized';
  open: () => void;
  close: () => void;
  minimize: () => void;
  toggle: () => void;
  isStreaming: boolean;
  hasError: boolean;
};
```

If that API feels too heavy during implementation, keep `RulesHelpSurface` as a single component that accepts a render prop for the button. The important boundary is that layouts own placement and `RulesChatPanel` no longer renders a global fixed launcher.

### 3. Add Collision Utilities

Create `src/components/help/rules-help-collision.ts`.

Recommended exports:

- `useRulesHelpCollision(surfaceRef, { enabled })`
  - Reads registered `[data-rules-help-avoid]` elements.
  - Computes safe bottom/right/top offsets.
  - Returns a style object with CSS variables.
- `getRulesHelpAvoidanceRects()`
  - Small pure helper for tests. It can accept viewport dimensions and element rects to produce offsets.
- `RULES_HELP_AVOID_ATTR = 'data-rules-help-avoid'`
  - Shared constant to avoid typo drift.

Implementation notes:

- Run measurement in `useLayoutEffect` on the client.
- Recompute on route changes, panel open/minimize transitions, resize, visual viewport resize, and avoid element resize.
- Ignore hidden elements and elements with zero rects.
- Include `window.visualViewport` offsets when available so mobile browser UI changes do not misplace the sheet.
- Use CSS variables instead of stateful class strings wherever possible to avoid layout thrash.

### 4. Update `useRulesChat`

File: `src/hooks/use-rules-chat.ts`.

Changes:

- Add bounded persistence:
  - Store completed messages in `sessionStorage` under `rulers.rulesChat.messages.v1`.
  - Store UI preference separately in `localStorage` under `rulers.rulesHelp.ui.v1`.
  - Cap stored messages to the last 40 turns or the same count used by the API route.
  - Do not persist a partial assistant message until streaming completes unless the stream is intentionally allowed to continue while minimized.
- Add `abort()` so the panel can expose a `Stop` action while streaming.
- Add `retryLast()` or document that retry is implemented by resubmitting the last user message after an error.
- Track a more explicit status:

```ts
type RulesChatStatus = 'idle' | 'streaming' | 'error';
```

- Keep `error` as a user-facing string parsed through `readErrorMessage`.
- Ensure clearing chat clears persisted messages and aborts any in-flight request.
- Ensure reload with malformed persisted JSON fails closed by clearing the bad key.

### 5. Update Game Layout

File: `src/app/game/[gameId]/layout.tsx`.

Current implementation path:

- Remove the direct `<RulesChat />` child.
- Wrap the authenticated route content and nav in `RulesHelpProvider`.
- Add `RulesHelpButton` next to the `Rulebook` link in the sticky nav when `!isJoinPage`.
- Render `RulesHelpPanel` once near the end of the layout so it can portal/fix itself above route content.
- Set `--rules-help-top-offset` based on the nav height. The simplest first pass can use a measured nav ref; if the nav is always sticky, a CSS fallback of `3.5rem` is acceptable.

Future app shell path:

- Move the same provider and button into the shell utility area from `docs/roadmap/01-app-shell-navigation.md`.
- Keep the provider mounted at the shell level, not in individual pages, so route transitions do not reset the conversation.

### 6. Update Rulebook Layout

File: `src/app/rules/layout.tsx`.

Because this is currently a server component, use one of these approaches:

- Preferred: create `src/app/rules/rules-help-layout-client.tsx` as a small client wrapper that renders the header help button, children, and `RulesHelpPanel` inside `RulesHelpProvider`.
- Alternative: make only the header utility area a client component and keep the rest of the layout server-rendered.

Concrete changes:

- Remove direct `<RulesChat />`.
- Add the `Ask Advisor` control to the header nav.
- Keep the existing `RulesSidebar` and main content structure.
- Set top offset from the header height so the desktop dock starts below the rulebook header.

### 7. Add Avoidance Hooks to Known Collision Surfaces

Files likely touched by this ticket or adjacent roadmap work:

- `src/app/game/[gameId]/setup/page.tsx`
  - Add `data-rules-help-avoid="bottom"` to any sticky mobile setup action bar if it exists by implementation time.
  - If this ticket lands before the mobile sticky action bar, document the attribute in the helper component planned by `docs/roadmap/06-mobile-responsiveness.md`.
- `src/components/map/HexMap.tsx` and `src/components/map/TerritoryHexMap.tsx`
  - Only add avoid attributes if right/bottom fixed map controls are introduced or current controls overlap the rules panel in manual QA.
- Future app shell command bars:
  - Add `data-rules-help-avoid` at the shell component level instead of page level.

Do not edit unrelated page layouts just to add speculative attributes. Start with the shell/header/footer surfaces that actually collide.

### 8. Styling

Files:

- `src/app/globals.css`
- New component-local Tailwind classes in `src/components/help/*` and `src/components/rules-chat/*`.

Guidelines:

- Retain the parchment/ink/gold visual language, but make the advisor feel like a shell utility, not a detached promotional widget.
- Keep panel radius at or below the existing `rounded-lg` and avoid nesting cards inside the panel.
- Preserve `.rules-chat-content` compact markdown overrides.
- Add CSS custom-property fallbacks:

```css
:root {
  --rules-help-safe-bottom: 1rem;
  --rules-help-safe-right: 1rem;
  --rules-help-top-offset: 3.5rem;
  --rules-help-panel-width: 24rem;
}
```

- Use `dvh`/`visualViewport`-aware sizing where possible for mobile sheets.

## State Persistence and Error/Loading Behavior

- Conversation messages:
  - Persist completed messages to `sessionStorage`.
  - Restore on provider mount.
  - Clear with the existing `Clear` action.
  - Cap size to avoid storage bloat and stay aligned with API `MAX_TURNS`.
- UI state:
  - Persist last preferred state as `closed` or `minimized`, not forcibly `open`, unless product explicitly wants open panels to survive refresh.
  - Persist last desktop/mobile placement only as a hint; always recompute from current viewport and collision data.
- Draft input:
  - Keep draft in provider state across minimize/open while the layout remains mounted.
  - Optionally persist draft to `sessionStorage` if implementation is cheap, but do not persist it to `localStorage`.
- Loading:
  - On send, append user message and assistant placeholder as today.
  - Composer button disables while streaming and changes to `Stop` or exposes a separate `Stop` control if abort is added.
  - Entry button communicates streaming when panel is minimized or closed.
  - Route changes under the provider should not abort the request.
- Errors:
  - Show API and network errors inline above the composer with `role="alert"`.
  - Preserve the user's last submitted question and offer `Retry` when possible.
  - Do not remove prior successful assistant messages after a failed send.
  - Missing `OPENROUTER_API_KEY` should surface the server message in development and a user-friendly fallback in production if desired.
- Abort:
  - User-triggered stop leaves the partial assistant response visible with a small `Stopped` status, or removes the empty assistant placeholder if no content arrived.
  - Provider unmount should abort in-flight streams.

## Accessibility Requirements

- The shell entry point must have an accessible name, `aria-expanded`, and `aria-controls` when the panel is mounted.
- The panel must expose a programmatic title such as `Rules Advisor`.
- Overlay drawer/sheet modes should use `role="dialog"` and `aria-modal="true"` when they block interaction with the page.
- Desktop dock mode may use `role="complementary"` with an accessible label if it does not block the page.
- Focus behavior:
  - Opening by keyboard moves focus into the panel header or composer.
  - Closing/minimizing restores focus to the triggering help button.
  - Escape closes or minimizes consistently.
  - Focus must not be trapped in non-modal desktop dock mode.
- Composer:
  - `Enter` submits and `Shift+Enter` inserts a newline, matching the current behavior.
  - Submit/stop controls remain at least `44px` in the touch dimension on mobile.
  - Disabled state while streaming is conveyed through `disabled` and visible status text.
- Message list:
  - New assistant content should be announced politely without reading the entire transcript on every streamed chunk. Use a final or throttled `aria-live="polite"` region for status rather than putting the whole scrolling log in a live region.
  - User and assistant messages should have clear visual distinction that does not rely only on color.
- Collision behavior must not hide focus outlines, validation messages, sticky action bars, or page-level primary actions.
- Mobile sheet must support browser text zoom up to 200% without clipped composer controls or horizontal overflow.

## Testing Strategy

Automated checks:

- Add component tests for `RulesChatPanel`:
  - Empty state renders.
  - User and assistant messages render with markdown.
  - Send is disabled for blank input and while streaming.
  - Clear, close, minimize, stop, and retry callbacks fire.
- Add hook tests for `useRulesChat`:
  - Successful streaming appends chunks into an assistant message.
  - Non-OK responses show parsed errors.
  - Clear aborts and clears persisted storage.
  - Restores valid persisted messages and discards malformed persisted JSON.
- Add pure tests for collision helper math:
  - Bottom avoid element increases bottom inset.
  - Right avoid element increases right inset only when relevant.
  - Small viewport switches to sheet placement.
- Existing API route tests are not required for this UI ticket unless route behavior changes.

Manual or Playwright viewport checks:

| Viewport | Route | Required checks |
| --- | --- | --- |
| 320x568 | `/game/[gameId]/setup` | help button reachable; mobile sheet fits; sticky actions are not covered |
| 390x844 | `/game/[gameId]/realm` | open/minimize/close preserves draft and messages; no horizontal overflow |
| 768x1024 | `/rules` | rulebook sidebar/content remain usable; advisor uses drawer or dock appropriately |
| 1024x768 | `/game/[gameId]/map` | panel does not cover critical map controls after collision measurement |
| 1280x800 | `/game/[gameId]/gm` | desktop dock attaches to shell, does not obscure nav or primary dashboard actions |

Interaction checks:

- Ask a rules question, receive a streamed answer, minimize while streaming, and reopen after completion.
- Trigger an API error by running without `OPENROUTER_API_KEY` in development and confirm the error is visible and accessible.
- Clear chat and refresh; messages stay cleared.
- Navigate between game subroutes; conversation and draft survive while the provider remains mounted.
- Navigate between `/game/[gameId]/*` and `/rules`; persisted conversation restores without carrying open overlay state that blocks the new page.
- Test keyboard-only open, send, stop, clear, minimize, close, and Escape behavior.

Run project checks:

- `npm run typecheck`
- `npm run lint`
- `npm test`

## Acceptance Criteria

- `RulesChat` no longer renders its own global fixed bottom-right button and panel.
- Game and rulebook layouts expose a first-class shell/header help entry point for the rules advisor.
- The advisor panel can open, minimize, close, clear, stream, abort/stop, and retry failed sends without losing successful history.
- Chat history persists across refreshes within the browser session and is explicitly cleared by `Clear`.
- The panel and any fallback minimized tab respect registered collision surfaces and mobile safe areas.
- At `320px` width, opening the advisor uses a sheet/dialog pattern with no horizontal overflow and no covered sticky page actions.
- On desktop, the open advisor is visually attached to the shell/help area and does not obscure sticky nav controls.
- Error and streaming states are visible in both the panel and the minimized/header entry point.
- Keyboard and screen-reader users can open, operate, and dismiss the advisor with focus restored correctly.
- Existing markdown answer rendering and compact `.rules-chat-content` styling continue to work.
- `npm run typecheck`, `npm run lint`, and `npm test` pass.

## Risks and Open Questions

- The app shell roadmap may land before or after this ticket. The implementation should keep the provider/button API small enough to move from current layouts into the future shell without rewriting chat internals.
- Collision measurement can become brittle if many pages invent their own fixed surfaces. Prefer a small documented `data-rules-help-avoid` contract over one-off per-page math.
- Persisting chat messages in `sessionStorage` is convenient, but the transcript may include user-entered campaign details even though the advisor should answer only rules. This is why session storage is preferred over long-lived local storage for messages.
- The current API streams plain text after parsing upstream SSE. If malformed chunks or upstream interruptions become common, the route may need stronger stream parsing and terminal error signaling.
- It is unclear whether users expect the advisor to remain open when moving from game routes to `/rules`. The spec recommends restoring conversation but not forcibly reopening the panel across different layout families.
- If the future shell has a left rail plus top bar, placement should be retested so the advisor does not compete with navigation density on medium widths.
