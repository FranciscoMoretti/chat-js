# Logical chat controller — local implementation

Branch: `francisco/eve-logical-chat`, based on package integration commit `2d71d8f795a8a537d4e4a3ac1f526d717b3ea3f4`. Local app: http://localhost:3060 (worktree slot 6).

## Implemented contract

A logical chat owns the stable URL, reconstructed message tree, cursor, comparison slots, and per-execution command state. Each native branch retains its EVE session. Layout-owned native observers survive view selection changes. EVE remains the source of transcript parts and execution events; the controller projects existing persisted branch intent and native replay, without another persisted transcript.

Session-qualified identities and explicit prefix aliases prevent native message-ID collisions. Retry aliases the original user and appends an assistant sibling; edit creates a user sibling. Version navigation selects its rightmost descendant. Cold hydration chooses the newest branch activity. Background observations do not steal an explicit selection. Comparison candidates retain admission order, duplicate model slots, unresolved admissions, and retry attempts. Editing a group preserves its complete model selection.

Included the existing optimistic first-message UI, creation recovery, and stream control version fix. Initial runtime registration no longer freezes the first response. Reading a branch no longer mutates shared active-conversation state.

## Verification on 2026-09-20

- `bun lint`: passed, including documentation checks.
- `bun test:types`: all seven workspace tasks passed.
- From `apps/chat`, `bun x vitest run lib/eve components/eve/use-eve-fork.test.tsx`: 65 files, 341 tests passed.
- Live Playwright: `eve-logical-chat.e2e.ts`, `eve-comparison-ui.e2e.ts`, and `eve-optimistic-create.e2e.ts`: all six tests passed together (1.2 minutes). Covers real native retry/edit/reload, stable chat URLs, nested duplicate-model groups, group editing, unsent drafts, guest and registered initial sends, optimistic rejection recovery, project attachments, and Back/Forward. Initial-send tests inspect document requests and message continuity while stream attachment is deliberately held.
- Next.js MCP: no runtime errors or compilation issues.
- Inspected captured nested comparison, edited branch, and mobile optimistic attachment screenshots. Hosted UI Verify previews failed; no passing remote visual baseline comparison is claimed.

The unit suite covers background cursor stability and execution command isolation. The browser suite does not yet prove cancellation isolation between two actively executing models or process-crash recovery; those remain verification gaps.

## Fork package dependency

Used a rebuilt local `@chat-js/eve@0.61.0-chatjs.0` tarball because the fork package is not published. Real startup exposed a package self-resolution bug: internal `eve/*` lookups could not resolve from the scoped distribution. The fix is in `/Users/fran/code/eve-chatjs-release/packages/eve/src/internal/application/package.ts`, with an isolated scoped-install regression check in `scripts/test-chatjs-package.mjs`. The tarball build, package smoke check, and real app startup passed. The package fix must accompany publication; the application manifest and lockfile were not changed to machine-specific tarball paths.

## Scope and remaining limits

Keep the runtime/provider, DB branch DTO, tree projection, UI wiring, and their regression tests together: they implement one logical-chat selection contract. The natural lower-layer change is the separate fork packaging fix above. Removed the superseded route-owned comparison/version controllers and heuristic sibling projection. No new database migration was needed. No changes were committed or pushed.

This does not add native idempotent acceptance lookup for ordinary sends. Existing unconfirmed-delivery recovery remains conservative and never automatically resends. This is a local controller implementation, not a claim of complete migration parity for every sharing, import, failure, or lifecycle scenario. Runtime eviction beyond owner changes is also not introduced here.
