# Proposal: suspend idle Eve observation without losing runtime state

Status: proposed, October 7, 2026. This document requests design review; it does not implement a lifecycle change or change production settings.

## Problem and evidence

The layout retains opened logical chats. Each branch mounts a `NativeObserver` with `useEveAgent({ resume: true })`, independently of whether its UI is active. `LogicalChat.setVisible(false)` changes UI follow state, not transport lifetime. The stream continues after `turn.completed`; idle leases expire after 60 seconds and reconnect immediately with the same cursor. Each renewal traverses the authenticated Next proxy and Eve.

The investigation examined deployed commit `4dae2bc7391ced380f1d99f02c716e1a62cddf86` and `@chat-js/eve@0.61.0-chatjs.0`. In the measured hour, 58 paired streams accounted for 116 of 133 requests, with unchanged `startIndex=2995`. ChatJS recorded 100.28 active CPU seconds: 98.5 ordinary functions and 1.78 middleware. This is correlation, not route-level CPU attribution or an explanation of the entire monthly usage.

An offline reproduction against that exact package compressed the server heartbeat/lease timers and observed four requests, zero events, the same cursor on every request, and three old-source cancellations. It supports idle reconnection, not an orphan-reader leak. Workflow uses streaming HTTP here; the investigation did not establish continuous database polling. Raw investigation artifacts remain local and are not included in this proposal.

Relevant code: [runtime provider](../apps/chat/components/eve/eve-runtime-provider.tsx), [logical chat](../apps/chat/lib/eve/logical-chat.ts), [authenticated proxy](../apps/chat/app/api/eve/[...path]/route.ts), and [conversation queries](../apps/chat/trpc/routers/eve.router.ts).

## Options

| Design | Benefit | Cost or correctness risk | Recommendation |
| --- | --- | --- | --- |
| Conditionally mount current observers | Small application change | Reconstructs stores at cursor zero; history replay and local command-state loss | Reject |
| Retain stores and suspend transport | Removes unwanted streams while preserving projections | Requires a supported Eve observation contract and explicit wake-up policy | Foundation |
| Bounded activity checks while idle | Discovers later work without a continuous stream per session | Per-session fan-out or frequent full snapshots can erase savings | Add with batching and measurement |
| Shared owner activity feed | Discovers scheduled work, external messages and new branches | Requires durable revisions, authorization and reconnect reconciliation | Longer-term option |
| Share session transport across tabs | Removes duplicate subscriptions | Leadership, failover, identity isolation and projection synchronization | Defer until measured |
| Longer leases or direct authenticated Eve access | Reduces renewal frequency or a proxy hop | Does not eliminate unnecessary observation; operational and authorization tradeoffs | Secondary optimization |

## Recommended seam

Eve should own the observation module because it already owns the store, cursor, reducer and command lifecycle. ChatJS should supply observation demand from its runtime registry, independently of UI mounting. Retained state means browser-memory state here; durable execution remains server-owned.

A proposed interface is `store.setObservation("live" | "catch-up" | "off")`:

- `live`: catch up and continue following.
- `catch-up`: consume through a captured durable tail, then detach. Later appends belong to the next reconciliation.
- `off`: close observation while retaining events, projection, cursor and command identity.

This interface does not exist today. Eve's internal detach helper closes the stream but also aborts local turn waiters; internal attach alone does not resume observation. Exposing these helpers unchanged is insufficient. Observation transitions must not cancel durable execution, misreport command completion or silently authorize retry. Command dispatch and uncertain delivery need independent lifetimes.

Do not use `agent.cancel()` to detach: it cancels durable work. `reset()` clears local state. Changing the current hook's `resume` option after mounting does not pause observation. Saving only the cursor is also insufficient: the examined store resumes from zero when its retained event count and session cursor disagree. Preserve the complete store, or define and validate a complete hydration checkpoint before introducing eviction or persistence.

## Observation and wake-up policy

Keep observation state separate from execution state. A disconnected browser's last known status cannot prove that the server is idle.

| Situation | Proposed behavior |
| --- | --- |
| Visible chat with running work | Follow relevant running branches, including comparison siblings |
| Visible chat, caught up and last known idle | Detach once activity discovery is available |
| Inactive chat or branch | Retain state; detach unless foreground progress depends on it |
| Approval or input waiting | Preserve the prompt; discover resolution elsewhere and reconcile before responding |
| Hidden browser tab | Detach after a short grace period; reconcile on return |
| Navigation, visibility return or network recovery | Refresh branch membership and catch up relevant sessions |
| Send, steer, retry or approval response | Coordinate observation with dispatch and reconcile resulting events |
| Owner change or logout | Dispose that owner's stores and subscriptions |

Ancestor branches may need finite hydration to reconstruct a visible path without continuous observation. Selected branch alone is not sufficient demand information for comparisons or path reconstruction.

Stopping at `turn.completed` is not a complete policy: queued follow-ups, scheduled runs, external channels or another tab may produce later events. Introduce a bounded, owner-scoped activity check that returns compact durable revisions and execution/attention state, with a way to discover new branches and conversations. Every requested session must be authorized. Missing, inaccessible and unchanged state must not be confused.

Discovery must cover every producer. A dirty marker written only by browser commands misses scheduled and external work. Existing conversation queries are not established as this complete contract. Evaluate the existing [batch stream-position proposal](upstream-drafts/eve-batch-stream-positions.md) for position checks, while separately handling execution state and family discovery; position equality is not proof of settlement. Avoid repeated full-history snapshots.

On a changed revision, catch up from retained state. On visibility return or reconnect, reconcile regardless of notification delivery. A notification is a hint backed by durable reconciliation. Capture a tail for each catch-up so continuous appends cannot prevent completion; a revision after that tail must trigger another pass or live observation.

Multiple tabs can initially observe independently with hidden tabs suspended. If duplicate visible-tab cost becomes material, add account-scoped leadership and revision broadcasts with failover and catch-up. Do not make correctness depend on receiving every cross-tab message.

## Correctness requirements

- Advance the retained cursor consistently with accepted events and projection; deduplicate replay. A cursor ahead of the available durable stream requires recovery, not silent success.
- Serialize observation transitions and ignore callbacks from obsolete connection generations. Resume without opening duplicate readers.
- Preserve submitted and uncertain command identities across detachment. Observation failure is not permission to resend.
- Handle queued/steered turns and pending authorizations before interpreting a turn boundary as idle.
- Reconcile approval state before acting when another client may have resolved it; preserve server-side validation.
- Refresh branch membership and invalidate document/metadata queries after catch-up. Some current invalidations depend on live event callbacks.
- Preserve authentication and ownership checks on every reconnect or activity request. Observation caching must not cross owners or indefinitely conceal revoked access.

## Rollout and validation

1. Add and test Eve's supported store-preserving lifecycle. Keep the existing transport policy as the default until ChatJS opts in.
2. Suspend inactive chats and hidden tabs behind a rollout flag. Keep visible chats live initially. This reduces accumulated observers but does not solve an idle chat left visible. No database change is expected for this stage.
3. Establish complete activity discovery, measure its cost, then detach visible idle chats. Refresh family membership during reconciliation. Durable indexing may be needed for discovery.
4. Consider shared feeds, cross-tab transport or lease tuning only after measuring remaining cost.

Protect the contract with focused tests: retained-cursor reconnect without history loss; detach during dispatch without cancellation or duplicate submission; later work after completion; queued follow-ups and comparison siblings; approval resolution elsewhere; rapid navigation and owner changes; stale callback rejection; and metadata/document repair after catch-up. Browser checks should cover navigation, hidden/visible transitions, network recovery and two tabs. Implementation must run repository lint, type checks and relevant tests, plus visual verification for UI changes.

Measure open streams, idle renewals, replay volume, discovery latency and route-level CPU separately for the proxy and Eve. Compare equivalent workloads before and after rollout. A 30-second check is 120 checks/hour; replacing roughly 60 paired renewals with frequent checks is not automatically cheaper. Batch checks, avoid hidden-tab polling and measure server work, not just request counts.

Acceptance target: no continuous per-session streams while fully idle after stage 3, retained history on reactivation, and no missed durable events after reconciliation. No CPU reduction percentage is promised from the current evidence.

## Product decisions for review

- Freshness: must external/background activity appear immediately, within a bounded interval, or on return? Recommended default: live foreground execution, bounded discovery while visible and idle, reconciliation on return for hidden tabs. Choose the interval after cost and latency measurement.
- Notifications: do hidden tabs or closed browsers need completion/approval alerts? If yes, provide an appropriate server-driven notification path rather than relying on a tab staying alive.
- Retention: how much inactive browser-memory history should remain? Keep eviction out of the first change; later eviction needs a complete hydration contract.

Longer leases reduce setup frequency but retain unnecessary subscriptions and must respect deployment limits and revocation expectations. Direct Eve access would need scoped credentials, equivalent authorization and safe renewal. Neither is required for the recommended lifecycle work.
