# Consistent Mutation Feedback and Error Handling

## Problem Statement

Many client-side mutations currently treat a completed `fetch` as a completed save. Some flows ignore `response.ok`, optimistically update local state after failed requests, close dialogs before confirming persistence, or provide no visible success/failure feedback. This makes saves feel untrustworthy in realm setup and active-game workflows where failed writes can silently leave the database unchanged.

The fix should establish one app-wide mutation pattern: every save checks the API result, exposes progress, reports actionable failures inline, confirms successful persistence, and only updates local UI as optimistically as the workflow can safely support.

## Goals

- Make every user-initiated create/update/delete mutation check `response.ok` before committing UI state or closing editing UI.
- Provide consistent pending, success, failure, and retry affordances across realm, settlement, GOS, military, noble, and turn-action workflows.
- Centralize API error parsing so components do not hand-roll `{ error }` parsing.
- Preserve useful existing patterns, especially `readErrorMessage` in `src/lib/http.ts`, `parseResponse` in `src/components/turn-actions/api-client.ts`, and focused inline validation.
- Keep migration incremental. Engineers should be able to convert one page or workflow at a time without a large state-management rewrite.
- Ensure feedback is accessible to keyboard and screen-reader users and works on narrow layouts.

## Non-Goals

- Replace the app's custom UI primitives with a third-party component or toast library.
- Introduce React Query/SWR for mutation state in this pass.
- Redesign API contracts beyond normalizing error payload shape and parsing.
- Add real-time cross-client conflict resolution.
- Convert all data loading paths. This spec focuses on writes, though shared parsing should also be usable by loaders.

## Current State References

- `src/app/game/[gameId]/realm/page.tsx`
  - `saveIdentity` sets `saving`, sends `PATCH /api/game/:gameId/realms`, never checks `response.ok`, then updates `realm` locally as if the write succeeded.
  - `finalizeSetup` checks `response.ok` but does not surface a failure message; the button can stop spinning with no explanation.
- `src/app/game/[gameId]/realm/settlements/page.tsx`
  - Initial data loads use `.then((r) => r.json())` without error handling.
  - `renameSettlement` returns silently on `!response.ok`, leaving the user in edit mode without an error.
  - `assignBuildingOwner` and `cancelConstruction` return silently on failure.
  - `createGosInline`, `constructBuilding`, `openUpgradeDialog`, `applyUpgrade`, and `updateStronghold` parse errors locally with repeated `response.json().catch(() => ({}))` code.
  - Dialog submit buttons are disabled during loading, but successful saves do not show confirmation.
- `src/app/game/[gameId]/realm/gos/page.tsx`
  - `createGos` and `saveEdit` ignore the returned status; dialogs close and lists reload even if the API rejects the request.
- `src/app/game/[gameId]/realm/army/page.tsx`
  - `createArmy` checks `response.ok` via `readErrorMessage`, but `createFleet`, `recruitTroop`, and `constructShip` do not.
- `src/app/game/[gameId]/realm/nobles/page.tsx`
  - `saveSelectedNoble` has local loading/error state and checks `response.ok`, but its parsing pattern differs from other pages.
- `src/components/governance/NobleStatusEditor.tsx`
  - Good reference for a small inline mutation: disabled save button, `readErrorMessage`, and local error text.
- `src/components/governance/NobleAssignmentSelect.tsx`
  - Useful reference for child-level pending/error display, but it currently depends on parents returning error strings.
- `src/components/turn-actions/api-client.ts`
  - `parseResponse` throws on non-OK responses, but it is scoped under turn-actions and only understands a simple `{ error }` payload.
- `src/lib/http.ts`
  - `readErrorMessage` already handles `{ error }` and `blockers`, but it returns only strings and does not expose status/code/details for richer UI.
- `src/lib/api-errors.ts`
  - Server routes sometimes return `{ error }`, and rule/economy errors can include `{ error, code, details }`. Client parsing should preserve that structure.

## Proposed UX Patterns

### Inline Errors

- Show validation or persistence errors at the smallest relevant scope:
  - Field-level for invalid inputs, for example blank settlement names.
  - Row-level for inline row controls, for example building owner assignment and construction cancellation.
  - Dialog-level for modal create/update flows, for example building construction or GOS creation.
  - Page-level banner only when a global action or refresh fails.
- Inline errors should include a retry action when the original action is still valid: `Retry`, `Try again`, or re-enabled primary submit.
- Do not close dialogs, exit edit mode, or clear forms after a failed mutation.
- Replace silent `return` branches on `!response.ok` with parsed error display.

### Success Toasts and Status

- Add a lightweight app-owned toast/status system instead of a dependency:
  - `src/components/ui/toast.tsx`: `ToastProvider`, `useToast`, and a fixed viewport.
  - Support `success`, `error`, and `info` variants.
  - Auto-dismiss success toasts after about 4 seconds; keep error toasts until dismissed or replaced if they describe global failures.
- Use toasts for completed writes that change saved state but do not already produce obvious navigation or dialog closure.
- Use inline status text for compact controls where a toast would be too noisy, for example `Saved` beside realm identity or an inline select.
- Avoid success toasts for every keystroke-like mutation. Debounced/autosave flows should use persistent `Saving...`, `Saved`, and `Could not save` status text.

### Optimistic Updates

- Only perform optimistic UI updates after the mutation is started when rollback is cheap and local state has a known previous value.
- For setup identity and inline owner/governor selects:
  - Store the previous value.
  - Show `Saving...`.
  - On success, keep the new value and show `Saved`.
  - On failure, restore the previous value, show the parsed error inline, and keep focus near the control.
- For destructive or consequential mutations, such as cancel construction, turn submission, turn advancement, and building construction:
  - Do not optimistically remove or add records.
  - Disable the initiating control while the request is pending.
  - Refresh authoritative state after success.
- For dialog creates/updates:
  - Keep the dialog open while pending.
  - Close only after a successful response and any required refresh completes.

### Disabled and Loading States

- Every mutation control should disable itself while its request is in flight.
- Use scoped pending state instead of page-wide `saving` whenever multiple controls can be used independently:
  - `savingIdentity`
  - `savingSettlementNameId`
  - `savingBuildingOwnerId`
  - `cancellingBuildingId`
  - `creatingGos`
- Button labels should remain stable enough to avoid layout shift. Prefer fixed-width content or short replacements like `Saving...`, `Building...`, `Cancelling...`.
- Use `aria-busy` on forms/dialog sections that are waiting for a mutation.
- Prevent duplicate submissions from Enter, blur, and button click races. `renameSettlement` currently saves on submit and blur; the migrated version should dedupe by settlement id and trimmed value.

### Retry Handling

- Retrying should re-use the same submitted payload, not whatever partial state happens to exist after the failure, unless the user edits the form.
- For page-level load/refresh failures after a successful mutation, show a specific message such as `Saved, but failed to refresh settlements` and expose `Refresh`.
- For network failures, show a generic offline-safe message: `Could not reach the server. Check your connection and try again.`
- For authorization/setup-phase failures, show the server message verbatim when available because it often explains the game-state rule.

## Implementation Plan

### 1. Centralize Client API Parsing

Create `src/lib/api-client.ts` and migrate call sites toward it:

```ts
export interface ApiClientErrorPayload {
  error: string;
  code?: string;
  details?: unknown;
  blockers?: Array<{
    id: string;
    displayName?: string | null;
    missingRequirements?: string[];
  }>;
}

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  blockers?: ApiClientErrorPayload['blockers'];
}

export async function parseApiResponse<T>(response: Response, fallback: string): Promise<T>;
export async function requestJson<T>(input: RequestInfo | URL, init: RequestInit, fallback: string): Promise<T>;
```

Recommendations:

- Move the blocker formatting from `src/lib/http.ts` into this module or have `readErrorMessage` delegate to it.
- Keep `readErrorMessage(response, fallback)` as a compatibility wrapper during migration.
- Re-export or replace `src/components/turn-actions/api-client.ts` so turn panels and app pages share one parser.
- Support `204 No Content` by returning `undefined as T` when appropriate.
- Include response `status`, parsed `code`, parsed `details`, and blocker metadata on thrown `ApiClientError`.
- On invalid/non-JSON error bodies, throw `ApiClientError(fallback, { status })`.

### 2. Add Shared Feedback UI

Add these small custom components/hooks:

- `src/components/ui/mutation-feedback.tsx`
  - `InlineMutationMessage` for error/success/status text.
  - Props: `id`, `status`, `message`, `retryLabel`, `onRetry`.
  - Renders with `role="alert"` for errors and `role="status"`/`aria-live="polite"` for success.
- `src/components/ui/toast.tsx`
  - `ToastProvider` mounted in `src/app/layout.tsx`.
  - `useToast().success(message)`, `useToast().error(message)`, `useToast().info(message)`.
- `src/hooks/use-mutation-state.ts`
  - Tracks `{ status: 'idle' | 'pending' | 'success' | 'error', error, successMessage }`.
  - Offers `run(asyncFn, { successMessage, onSuccess, onError })`.
  - Does not own data fetching or caching; it only standardizes pending/error/success state.

Keep the hook optional. For very simple handlers, directly using `try/catch/finally` with `requestJson` is acceptable if the UI still follows the same states.

### 3. Migration Order

1. Realm identity and setup finalization:
   - Convert `saveIdentity` in `src/app/game/[gameId]/realm/page.tsx` to `try/catch/finally`.
   - Use `requestJson<{ updated: true }>` for `PATCH /realms`.
   - Update local `realm` only after success.
   - Add inline `Saving...`, `Saved`, and error text beside the identity controls.
   - Convert `finalizeSetup` to parse non-OK responses and display checklist/server errors.
2. Settlements page:
   - Replace silent `!ok` returns in `renameSettlement`, `assignBuildingOwner`, and `cancelConstruction`.
   - Use row-scoped pending/error state keyed by settlement/building id.
   - Keep construction/upgrade dialog errors inline, but source messages from `ApiClientError`.
   - Close build/upgrade/create-GOS dialogs only after success.
3. GOS page:
   - Add create/edit dialog error state.
   - Do not clear form fields or close dialogs until `POST /gos` or `PATCH /gos` succeeds.
   - Show success toast after creation/edit because the result appears in a list and dialogs close.
4. Army/fleet/recruitment/ship construction:
   - Keep the existing `createArmy` pattern but switch parser.
   - Add scoped pending/error state for `createFleet`, `recruitTroop`, and `constructShip`.
   - Show inline errors in the active dialog and refresh military state only after success.
5. Noble and governance controls:
   - Convert `NobleStatusEditor`, `NobleAssignmentSelect` callers, and `saveSelectedNoble` to the shared parser.
   - Prefer `onAssign` throwing `ApiClientError` over returning strings once all callers are migrated.
6. Turn action panels:
   - Replace `src/components/turn-actions/api-client.ts` with the shared parser or re-export it.
   - Preserve existing page-level errors for refresh/save/advance, then add success status for submitted/advanced turn flows.
7. Broad cleanup:
   - Run `rg "if \\(!.*\\.ok\\) return|await fetch\\(" src/app src/components` and audit every remaining mutation.
   - Leave documented exceptions only for fire-and-forget telemetry-like calls; none are known today.

## API and Client Error Parsing Considerations

- Standardize server error payloads as:

```json
{
  "error": "Human-readable message",
  "code": "machine_readable_code",
  "details": {},
  "blockers": []
}
```

- Existing routes already return compatible shapes through `src/lib/api-errors.ts` for auth, governance, rule validation, economy resolution, and quick-combat errors.
- Client parsing should prefer `error`, append formatted blockers when present, and preserve `code/details/blockers` for future UI.
- Do not assume every error response is JSON. Handle HTML, empty body, aborted requests, and malformed JSON.
- Distinguish aborts from failures when using `AbortController` for loaders. User-initiated mutations should usually not be aborted silently unless the component unmounts.
- Include fallback messages at the call site so the parser can produce workflow-specific text.
- API routes that currently throw unexpected errors can continue to throw; Next will produce 500 responses, and the client should display the fallback.

## Testing Strategy

- Add unit tests for `src/lib/api-client.ts`:
  - Success JSON.
  - Success empty body.
  - `{ error }` failures.
  - `{ error, code, details }` failures.
  - `{ error, blockers }` formatting.
  - Non-JSON failure body and network rejection fallback.
- Add React Testing Library coverage around migrated workflows:
  - Realm identity does not update title or show `Saved` when `PATCH /realms` returns non-OK.
  - Settlement rename keeps edit mode open and displays the server error on failure.
  - Building owner select rolls back after a failed `PATCH /buildings`.
  - GOS create/edit dialogs stay open on failure and close only after success.
  - Army/fleet/recruitment/ship dialogs show inline failures and prevent duplicate submits while pending.
- Extend existing route tests only where response payloads need normalization.
- Use existing commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`
- For manual QA, simulate a 403 by using a player session against a GM-only edit, and simulate a 409 rule validation error by attempting an unavailable building action.

## Accessibility and Responsiveness Requirements

- Error text must be associated with the relevant control via `aria-describedby` where the control has a clear owner.
- Error messages use `role="alert"`; success and saving status use `role="status"` with `aria-live="polite"`.
- Pending form/dialog regions use `aria-busy="true"`.
- Disabled buttons must not be the only indication of progress; include visible text such as `Saving...`.
- Toasts must be keyboard reachable, dismissible, and not cover fixed navigation or dialog actions on mobile.
- Inline messages must wrap cleanly in compact grids such as settlement building rows. On narrow screens, row actions should stack rather than overflow.
- Do not rely on color alone. Pair red/green styling with text like `Could not save` and `Saved`.
- Preserve focus after failures. For dialog errors, focus can remain on the submit button or move to the error summary if the error is not adjacent.

## Acceptance Criteria

- All user-initiated mutations in the migrated pages check `response.ok` through the shared parser.
- `saveIdentity` no longer updates local realm state after a failed `PATCH /realms`.
- Settlement rename, building owner assignment, construction cancellation, GOS create/edit, fleet creation, troop recruitment, and ship construction no longer fail silently.
- Failed mutations show a parsed, user-visible error and leave the user's input recoverable.
- Successful mutations either show inline `Saved` status, close a dialog after persisted refresh, navigate, or show a success toast.
- Duplicate submissions are blocked while a mutation is pending.
- Shared parser tests and at least one workflow test for failure and success are added with the first implementation PR.
- `npm test`, `npm run typecheck`, and `npm run lint` pass after the migration PR.

## Risks and Open Questions

- Toast placement needs design review because the app has dialogs, dense setup pages, and themed cards; the default should be bottom-right on desktop and bottom full-width on mobile.
- Some flows may appear to succeed only after a refresh. Decide whether success means "API accepted" or "API accepted and refreshed state loaded"; this spec recommends the latter for list/detail workflows.
- Existing API routes are not fully consistent about status codes or error shapes. The client parser can tolerate that, but future route work should converge on `{ error, code, details, blockers }`.
- Optimistic rollback requires previous values. For complex entities, prefer authoritative refresh over optimistic edits until stronger state ownership exists.
- Multiple agents may touch docs and UI in parallel. Keep the parser/component migration in small PRs to reduce merge conflicts.
