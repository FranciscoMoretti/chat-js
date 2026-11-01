# Shared-agent MVP verification

Implementation branch: `codex/single-agent-guest-mvp`, based on `8dbcc370c521a0d2a4472f328b922940fd18ee4f`. Verification used an isolated local PostgreSQL 17 database, Node 24.20.0, production Next.js and EVE builds, and real AI Gateway calls. No production account data or hosted deployment was changed.

## Passed

- Full `bun lint`, including registry demo synchronization; workspace `bun test:types`.
- 115 focused tests covering durable guest policy, authorization, quota/rate admission, cleanup, lifecycle compatibility, health and canonical workflow identity. The final model/admission subset also passed after the minimal-reasoning adjustment.
- 24 hosting-script tests, including draining both legacy and runtime cleanup batches.
- All five guest browser tests against the production app: a real reply, reload disposal, failures and expiry, locked model, New Chat, late bootstrap retirement, and back-forward cache behavior. Screenshots were captured and the reply presentation inspected.
- Guest API tests against the running app: model override, file content, fork/compact and account API requests denied; unauthenticated and cross-session stream access denied; no guest account-conversation or usage-ledger rows created.
- Real two-turn guest conversation including previous assistant history. GPT-5 nano uses minimal reasoning with a 512-token cap; default reasoning exhausted that small budget during investigation.
- Registered authentication, real model reply, persisted history, operation-ID replay and usage-ledger creation. History survived stopping and restarting Next.js and its worker. A guest credential could not read the actual account session.
- Live guest cleanup: aged only an isolated test policy while preserving its 24-hour database invariant, ran the protected cron endpoint, verified retirement, deletion receipt, absence of native run/event/step/stream payloads, and rejection of the old credential. Account workflow data remained separate.
- Separate PostgreSQL concurrency probes admitted exactly three requests with a three-message budget, and exactly two eight-character requests with a 20-character cumulative-input budget. Native lifecycle tests verified late-write fences and account preservation.

## Registered browser follow-up (2026-10-20)

After merging #866, rebuilt the EVE production worker and tested the registered UI in headed Chromium with an isolated, authenticated local account. Selected GPT-4.1 nano (Fast), sent a real message, reloaded, sent a follow-up that recalled the first message, returned to New Chat, and reopened the saved conversation. Desktop and mobile screenshots were inspected; mobile had no horizontal overflow. The account had four usage records (including auxiliary model work), no browser page errors, and no failed application requests. Local-only Vercel analytics script 404s were excluded from application-request assertions.

The first run exposed a test-configuration error: `PLAYWRIGHT=True` intentionally makes the layout anonymous, preventing the registered runtime from mounting even with a valid session cookie. Removing that flag and supplying the already configured instrumentation credentials resolved it without app-code changes. Authentication used a disposable local session, so this did not retest hosted OAuth or external connector/file operations.

## Fixes found during verification

The published EVE fork needed its canonical `workflow//eve//workflowEntry` identity preserved by the workflow transform; the checked-in patch and regression test cover that. Guest model validation now accepts server-generated assistant reasoning history while still denying nontext user input and tools. Registry-owned research/MCP guards live in their canonical sources and synchronize into the app.

## Limits and deployment requirements

This is local integration verification, not Render/Supabase certification or a full regression of every registered tool/provider. The cron endpoint correctly returned 503 because this isolated test environment had no configured attachment-storage credentials; its runtime-guest result independently reported one deletion and zero pending, and database payload deletion was verified. Attachment cleanup was not bypassed or weakened.

Apply migrations 0016 and 0017, run EVE setup to install/verify PostgreSQL lifecycle fences, configure the trusted client-IP header and protected hourly cleanup job, and deploy the single worker. Guest admission fails closed if the selected backend cannot prove cleanup support. Managed/local guest-only backends are not implemented. Existing guest tabs must reload; registered workflow history remains on the same backend.

The 24-hour target covers conversation payloads with hourly scheduling and retries, not all operational metadata or provider logs. Policy audit records and deletion fences remain. UI Verify captures passed locally, but remote baseline comparison was unavailable without `UIVERIFY_API_KEY`.

See [the memory comparison](../../../deployment/render/single-agent-memory.md): three idle worker trials showed 46.5 MiB less used heap and 19.9 MiB less external allocation. RSS was too noisy for a reliable saving or a 512 MiB Render capacity claim. The memory trial preceded the final workflow-identity and model-policy refinements; it measures the topology change rather than the exact final source revision.
