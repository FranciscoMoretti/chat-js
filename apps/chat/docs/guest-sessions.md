# Guest sessions in the shared agent

Registered and guest chats use one EVE agent and one worker. Both enter through `/eve/chat/v1/*`; authorization is based on server-verified credentials and the persisted session policy, not the public URL. Self-hosted deployments use the same PostgreSQL workflow backend for both session types. Backend selection remains deployment-scoped; a guest-only installation using another workflow backend is not part of this MVP.

Guest admission in this MVP requires the deployment-selected PostgreSQL backend and a verified lifecycle schema with enabled write and queue fences (`bun eve:setup`). Bootstrap checks lifecycle compatibility before creating a guest policy or native session and returns HTTP 503 if verification fails. Managed Workflow and custom Worlds remain available according to the registered application's existing backend selection, but cannot admit new guest sessions until a verified cleanup implementation exists. Selecting a backend is not sufficient evidence of retention support.

Guests keep the existing chat presentation at `/`. They get one inexpensive text model (`openai/gpt-5-nano`), with the picker locked. No tools, uploads, connectors, account APIs or account data are accessible. Server-owned policy enforces usage and rate limits plus bounded input and output. Registered authentication, billing, durable history and recovery keep their existing behavior.

Guest credentials are signed, expire, and authorize only their assigned session. The browser keeps the credential and conversation binding in memory; reload and New chat start fresh. Guest history does not migrate on sign-in. The guest and registered sessions use the same agent-level runtime timeout; credential expiry is a separate authorization boundary.

Guest transcripts are temporary PostgreSQL workflows with scheduled cleanup targeting 24 hours, replacing the separate guest agent's immediate workflow retention setting. Hourly cleanup means deletion can occur after the target by the scheduling interval, plus retries during failures; this is not a hard 24-hour deletion guarantee. Model-provider logs and observability retention are separate. Unload and New chat still request retirement on a best-effort basis. Operators must monitor the protected cleanup endpoint and retry unsuccessful sweeps.

This deployment removes the old `/eve/guest/v1/*` mount and guest worker. Existing open guest tabs should reload after upgrading; their old runtime sessions are not migrated. Registered session recovery must remain compatible with the existing workflow backend.

Run the guest browser suite with `bunx playwright test --config playwright.guest.config.ts` from `apps/chat`. It covers unauthenticated replies, session authorization, memory-only browser identity, reload and New chat. Policy/authentication, cleanup and registered workflow tests provide the server-side isolation checks.

The policy is 5 messages per IP per minute, 5 sessions per IP per hour, a one-hour credential, 4,000 characters per message, 24,000 cumulative user-input characters and a 24,000-character serialized model prompt, and 512 output tokens. GPT-5 nano uses minimal reasoning to leave room for visible output. Admission is charged before dispatch, including failed attempts. Configure a trusted proxy IP header; missing trusted client identity fails closed.

The 24-hour target applies to conversation/workflow payloads. Minimal deletion fences and policy audit metadata (including identifiers, counters and hashed IP) remain for safe retries and late-write prevention; rate buckets are pruned after two days. This is not a promise that all metadata disappears after 24 hours.

The plugin-owned `chatjs/plugins/guest-chat/guest-policy.ts` is authoritative. The obsolete `ai.anonymousModels` and `anonymous` settings are removed. The provider prompt includes assistant replies and framing, so a long conversation can reach that bound before its user-input allowance. Failed or ambiguous dispatches remain charged to admission capacity.

The plugin contributes a signed-out screen, native session profile, and cleanup task. Core keeps account ownership, tool guards, and verified deletion infrastructure. An installation without Guest Chat redirects signed-out chat visitors to `/login`, and installs no guest schema or bootstrap route.

Migration 0022 drops the old `EveGuest`, `EveGuestMessage`, and `EveGuestRate` tables and their conversation cleanup column. It stops if a legacy guest still owns an undeleted conversation: drain that inventory using the previous release before upgrading. Current `GuestRuntimeSession` and `GuestRuntimeRate` tables retain their names and data under plugin ownership.

Cleanup refuses ambiguous workflow queue ownership rather than risking another session's data. A partial batch reports its remaining expired backlog; the hosted scheduler continues batches that make progress and fails on stalled work so operators can retry. The default Vercel schedule remains daily for Hobby compatibility; PostgreSQL guest deployments need the hourly external scheduler described in the Render profile.

The migration sequence preserves the existing `0016_large_zeigeist` sandbox migration and introduces guest tables in `0017_flimsy_whiplash` and `0018_shallow_tyrannus`. The earlier disposable Render verification database used pre-review guest migration numbers. Do not automatically deploy this revised sequence to that database: provision a fresh verification database or reconcile its migration history and schema explicitly before rollout.
