# Guest sessions in the shared agent

Registered and guest chats use one EVE agent and one worker. Both enter through `/eve/chat/v1/*`; authorization is based on server-verified credentials and the persisted session policy, not the public URL. Self-hosted deployments use the same PostgreSQL workflow backend for both session types. Backend selection remains deployment-scoped; a guest-only installation using another workflow backend is not part of this MVP.

On managed Vercel, guest admission uses provider-managed workflow retention. Scheduled cleanup ends the session and completes the local credential policy; it does not promise payload erasure. Self-hosted PostgreSQL deployments still require a verified lifecycle schema with enabled write and queue fences (`bun eve:setup`). Their bootstrap checks compatibility before creating a policy or session and returns HTTP 503 if verification fails.

Guests keep the existing chat presentation at `/`. They get one inexpensive text model (`openai/gpt-5-nano`), with the picker locked. No tools, uploads, connectors, account APIs or account data are accessible. Server-owned policy enforces usage and rate limits plus bounded input and output. Registered authentication, billing, durable history and recovery keep their existing behavior.

Guest credentials are signed, expire, and authorize only their assigned session. The browser keeps the credential and conversation binding in memory; reload and New chat start fresh. Guest history does not migrate on sign-in. The guest and registered sessions use the same agent-level runtime timeout; credential expiry is a separate authorization boundary.

Scheduled cleanup targets session retirement after 24 hours, plus the scheduling interval and retries. PostgreSQL also purges native payloads; Vercel retains them under its provider policy. Model-provider logs and observability retention are separate. Unload and New chat request retirement on a best-effort basis. Operators must monitor the protected cleanup endpoint and retry unsuccessful sweeps.

This deployment removes the old `/eve/guest/v1/*` mount and guest worker. Existing open guest tabs should reload after upgrading; their old runtime sessions are not migrated. Registered session recovery must remain compatible with the existing workflow backend.

Run the guest browser suite with `bunx playwright test --config playwright.guest.config.ts` from `apps/chat`. It covers unauthenticated replies, session authorization, memory-only browser identity, reload and New chat. Policy/authentication, cleanup and registered workflow tests provide the server-side isolation checks.

The policy is 5 messages per IP per minute, 5 sessions per IP per hour, a one-hour credential, 4,000 characters per message, 24,000 cumulative user-input characters and a 24,000-character serialized model prompt, and 512 output tokens. GPT-5 nano uses minimal reasoning to leave room for visible output. Admission is charged before dispatch, including failed attempts. Configure a trusted proxy IP header; missing trusted client identity fails closed.

The 24-hour target applies to session retirement (plus scheduler delay and retries). On managed Vercel, workflow payloads follow provider retention; ChatJS does not claim they have been erased. On PostgreSQL the sweep also purges conversation/workflow payloads. Minimal deletion fences and policy audit metadata (including identifiers, counters and hashed IP) remain for safe retries and late-write prevention; rate buckets are pruned after two days. This is not a promise that all metadata disappears after 24 hours.

The plugin-owned `chatjs/plugins/guest-chat/guest-policy.ts` is authoritative. The obsolete `ai.anonymousModels` and `anonymous` settings are removed. The provider prompt includes assistant replies and framing, so a long conversation can reach that bound before its user-input allowance. Failed or ambiguous dispatches remain charged to admission capacity.

The plugin contributes a signed-out screen, native session profile, and cleanup task. Core keeps account ownership, tool guards, and verified deletion infrastructure. An installation without Guest Chat redirects signed-out chat visitors to `/login`, and installs no guest schema or bootstrap route.

Migration 0022 drops the old `EveGuest`, `EveGuestMessage`, and `EveGuestRate` tables and their conversation cleanup column. It stops if a legacy guest still owns an undeleted conversation: drain that inventory using the previous release before upgrading. Current `GuestRuntimeSession` and `GuestRuntimeRate` tables retain their names and data under plugin ownership.

Cleanup refuses ambiguous workflow queue ownership rather than risking another session's data. A partial batch reports its remaining expired backlog; the hosted scheduler continues batches that make progress and fails on stalled work so operators can retry. The default Vercel schedule remains daily for Hobby compatibility; PostgreSQL guest deployments need the hourly external scheduler described in the Render profile.

The migration sequence preserves the existing `0016_large_zeigeist` sandbox migration and introduces guest tables in `0017_flimsy_whiplash` and `0018_shallow_tyrannus`. The earlier disposable Render verification database used pre-review guest migration numbers. Do not automatically deploy this revised sequence to that database: provision a fresh verification database or reconcile its migration history and schema explicitly before rollout.

Managed Vercel guest admission does not invoke the PostgreSQL lifecycle. Cleanup verifies `session.ended` or the managed provider’s explicit `410 session_expired` response before completing the local credential policy. It reports `retiredCount` rather than `deletedCount` and retries other unsuccessful retirement. This does not change the stricter account-deletion contract.

EVE RC1 supports zero retention for new runs and derives it from trace policy when no explicit override is configured. Private production sessions normally request zero retention, which makes payloads unreadable after the owning run finishes. Physical deletion, metadata, and external traces follow separate provider policies. The explicit override is agent-wide; this guest fix does not change it or the account-history retention configuration. See [Vercel workflow retention](https://vercel.com/docs/workflows/retention).
