# Guest sessions in the shared agent

Registered and guest chats use one EVE agent and one worker. Both enter through `/eve/chat/v1/*`; authorization is based on server-verified credentials and the persisted session policy, not the public URL. Self-hosted deployments use the same PostgreSQL workflow backend for both session types. Backend selection remains deployment-scoped; a guest-only installation using another workflow backend is not part of this MVP.

Guest sessions request EVE native retention `0` on every backend. The installed instrumentation policy excludes guest input/output trace capture, which EVE uses to select zero retention; registered-user policy remains unchanged. Scheduled cleanup ends the session and completes the local credential policy. Guest admission and cleanup do not require the PostgreSQL purge lifecycle.

The pinned `@workflow/world-postgres@5.0.0-beta.40` accepts the retention preference but does not implement payload deletion. PostgreSQL guest payloads therefore remain stored until the provider implements it or an operator removes them separately. This is an accepted limitation, not a deletion guarantee. Vercel enforces its own retention policy. Native retention does not remove provider logs, traces already exported, or all run metadata.

Guests keep the existing chat presentation at `/`. They get one inexpensive text model (`openai/gpt-5-nano`), with the picker locked. No tools, uploads, connectors, account APIs or account data are accessible. Server-owned policy enforces usage and rate limits plus bounded input and output. Registered authentication, billing, durable history and recovery keep their existing behavior.

Guest credentials are signed, expire, and authorize only their assigned session. The browser keeps the credential and conversation binding in memory; reload and New chat start fresh. Guest history does not migrate on sign-in. The guest and registered sessions use the same agent-level runtime timeout; credential expiry is a separate authorization boundary.

Scheduled cleanup targets session retirement after 24 hours, plus the scheduling interval and retries. Payload retention is owned by the selected Workflow World. Model-provider logs and observability retention are separate. Unload and New chat request retirement on a best-effort basis. Operators must monitor the protected cleanup endpoint and retry unsuccessful sweeps.

This deployment removes the old `/eve/guest/v1/*` mount and guest worker. Existing open guest tabs should reload after upgrading; their old runtime sessions are not migrated. Registered session recovery must remain compatible with the existing workflow backend.

Run the guest browser suite with `bunx playwright test --config playwright.guest.config.ts` from `apps/chat`. It covers unauthenticated replies, session authorization, memory-only browser identity, reload and New chat. Policy/authentication, cleanup and registered workflow tests provide the server-side isolation checks.

The policy is 5 messages per IP per minute, 5 sessions per IP per hour, a one-hour credential, 4,000 characters per message, 24,000 cumulative user-input characters and a 24,000-character serialized model prompt, and 512 output tokens. GPT-5 nano uses minimal reasoning to leave room for visible output. Admission is charged before dispatch, including failed attempts. Configure a trusted proxy IP header; missing trusted client identity fails closed.

The 24-hour target applies to session retirement (plus scheduler delay and retries), not physical payload deletion. Cleanup reports `retiredCount`, with `deletedCount` zero. Local policy audit metadata (including identifiers, counters and hashed IP) remains for safe retries; rate buckets are pruned after two days. The PostgreSQL guest path no longer installs native payload/queue purge receipts or late-write fences. Account deletion still uses its separate lifecycle safeguards.

The plugin-owned `chatjs/plugins/guest-chat/guest-policy.ts` is authoritative. The obsolete `ai.anonymousModels` and `anonymous` settings are removed. The provider prompt includes assistant replies and framing, so a long conversation can reach that bound before its user-input allowance. Failed or ambiguous dispatches remain charged to admission capacity.

The plugin contributes a signed-out screen, native session profile, and cleanup task. Core keeps account ownership, tool guards, and verified deletion infrastructure. An installation without Guest Chat redirects signed-out chat visitors to `/login`, and installs no guest schema or bootstrap route.

Migration 0022 drops the old `EveGuest`, `EveGuestMessage`, and `EveGuestRate` tables and their conversation cleanup column. It stops if a legacy guest still owns an undeleted conversation: drain that inventory using the previous release before upgrading. Current `GuestRuntimeSession` and `GuestRuntimeRate` tables retain their names and data under plugin ownership.

Cleanup requires the exact guest policy/session binding and verified session ending or explicit expiry. A partial batch reports its remaining expired backlog; the hosted scheduler continues batches that make progress and fails on stalled work so operators can retry. The default Vercel schedule remains daily for Hobby compatibility; PostgreSQL guest deployments need the hourly external scheduler described in the Render profile.

The migration sequence preserves the existing `0016_large_zeigeist` sandbox migration and introduces guest tables in `0017_flimsy_whiplash` and `0018_shallow_tyrannus`. The earlier disposable Render verification database used pre-review guest migration numbers. Do not automatically deploy this revised sequence to that database: provision a fresh verification database or reconcile its migration history and schema explicitly before rollout.

Cleanup accepts `session.ended` or EVE's explicit `410 session_expired` response before completing the local credential policy. Empty history, missing sessions, authentication failures and transport errors do not prove retirement and remain retryable.

New guests authenticate with principal type `guest`. Before deploying this identity change onto an existing installation, stop guest admission and retire outstanding sessions using the previous code. Existing account sessions are unaffected; this change does not add guest identity compatibility aliases.

`agent/instrumentation/guest-retention.ts` is installed only with Guest Chat. It preserves EVE's default trace policy for non-guest principals; it does not set an agent-wide retention override. Guest payload tracing is disabled in development as well as production. See [Workflow retention](https://workflow-sdk.dev/docs/observability/retention).
