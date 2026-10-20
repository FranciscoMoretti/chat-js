# Guest sessions in the shared agent

Registered and guest chats use one EVE agent and one worker. Both enter through `/eve/chat/v1/*`; authorization is based on server-verified credentials and the persisted session policy, not the public URL. Self-hosted deployments use the same PostgreSQL workflow backend for both session types. Backend selection remains deployment-scoped; a guest-only installation using another workflow backend is not part of this MVP.

Guest admission in this MVP requires the deployment-selected PostgreSQL backend and a verified lifecycle schema with enabled write and queue fences (`bun eve:setup`). Bootstrap checks lifecycle compatibility before creating a guest policy or native session and returns HTTP 503 if verification fails. Managed Workflow and custom Worlds remain available according to the registered application's existing backend selection, but cannot admit new guest sessions until a verified cleanup implementation exists. Selecting a backend is not sufficient evidence of retention support.

Guests keep the existing chat presentation at `/`. They get one inexpensive text model (`openai/gpt-5-nano`), with the picker locked. No tools, uploads, connectors, account APIs or account data are accessible. Server-owned policy enforces usage and rate limits plus bounded input and output. Registered authentication, billing, durable history and recovery keep their existing behavior.

Guest credentials are signed, expire, and authorize only their assigned session. The browser keeps the credential and conversation binding in memory; reload and New chat start fresh. Guest history does not migrate on sign-in. The guest and registered sessions use the same agent-level runtime timeout; credential expiry is a separate authorization boundary.

Guest transcripts are temporary PostgreSQL workflows with scheduled cleanup targeting 24 hours, replacing the separate guest agent's immediate workflow retention setting. Hourly cleanup means deletion can occur after the target by the scheduling interval, plus retries during failures; this is not a hard 24-hour deletion guarantee. Model-provider logs and observability retention are separate. Unload and New chat still request retirement on a best-effort basis. Operators must monitor the protected cleanup endpoint and retry unsuccessful sweeps.

This deployment removes the old `/eve/guest/v1/*` mount and guest worker. Existing open guest tabs should reload after upgrading; their old runtime sessions are not migrated. Registered session recovery must remain compatible with the existing workflow backend.

Run the guest browser suite with `bunx playwright test --config playwright.guest.config.ts` from `apps/chat`. It covers unauthenticated replies, session authorization, memory-only browser identity, reload and New chat. Policy/authentication, cleanup and registered workflow tests provide the server-side isolation checks.

The MVP policy is 10 admitted messages per session, 5 messages per IP per minute, 5 sessions per IP per hour, a one-hour credential, 4,000 characters per message, 24,000 cumulative user-input characters and a 24,000-character serialized model prompt, and 512 output tokens. GPT-5 nano uses minimal reasoning to leave room for visible output. Admission is charged before dispatch, including failed attempts. Configure a trusted proxy IP header; missing trusted client identity fails closed.

The 24-hour target applies to conversation/workflow payloads. Minimal deletion fences and policy audit metadata (including identifiers, counters and hashed IP) remain for safe retries and late-write prevention; rate buckets are pruned after two days. This is not a promise that all metadata disappears after 24 hours.
