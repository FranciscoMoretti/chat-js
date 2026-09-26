# ChatJS workflow backends

Implemented September 26, 2026. This change is not a production cutover.

## Configuration contract

Registered chats select their world in `apps/chat/lib/eve/world-config.ts`:

- Vercel deployments: Eve's bundled `vercel` world.
- Local development, tests and self-hosted Node: `@workflow/world-postgres`.
- `VERCEL=1` selects the deployed path unless `VERCEL_ENV=development` or `NODE_ENV=development`. `NODE_ENV=production` alone never selects Vercel.
- No user-configurable world selector is introduced. A workflow database URL does not select the backend.

Compilation, environment validation, setup, billing and deletion guards use this resolver. Turbo passes and hashes the platform variables, preventing cache reuse across these target environments. Build for the destination environment; do not move a self-hosted artifact onto Vercel.

`DATABASE_URL` remains the application database on both targets. `WORKFLOW_POSTGRES_URL` is required outside Vercel, has no fallback to the application database, and is unused on Vercel. `EVE_GATEWAY_SECRET` and `EVE_INTERNAL_ORIGIN` remain required everywhere. The setup/build commands report the selected backend.

Disposable guests retain Eve's default world: isolated local storage in development, managed Workflow on Vercel, with their existing zero-retention policy. They do not share the registered agent's PostgreSQL queue. In the installed adapter, Graphile task names default to `workflow_flows` independently of Eve's agent queue namespace, and workers deliver to their own HTTP service. Pointing both agents at that queue would permit cross-service job consumption. Unifying their local storage requires separate queue/storage ownership and is deliberately not included.

## Application behavior

Usage reconciliation keeps application-owned durable billing cursors. The optional stream-position module reads PostgreSQL metadata locally and returns unknown positions on Vercel without accessing PostgreSQL. Unknown positions are reconciled through Eve's public stream with `startIndex`, `follow: false`, existing timeouts and a maximum of four concurrent readers. Every bound session is checked on managed-backend admission; there is no idle polling loop added here. PostgreSQL failures remain errors, rather than being treated as settled usage.

Hosted erasure remains unsupported by the installed Eve version. The existing deletion endpoint rejects unsupported configurations before revoking access. Additional guards prevent local SQL retirement/fencing from being selected on Vercel through leftover PostgreSQL settings. This change does not invent a managed deletion guarantee or equate retention with verified erasure.

Generated scaffolds include this configuration and exclude `.vercel` artifacts/project metadata at any directory depth.

## Verification

- App unit suite after rebasing onto the named-worker routing fix: 726 tests passed across 137 files.
- CLI unit suite: 86 tests passed. The scaffold artifact-exclusion tests also passed after adding `.vercel` coverage.
- `bun lint`, all seven `bun test:types` tasks, documentation links, and template consistency passed.
- Vercel-targeted Eve build completed using synthetic credentials and an empty workflow PostgreSQL URL. Sandbox prewarming was skipped. The generated server selects package `vercel`, applies Vercel world defaults and contains no Graphile worker code. This is artifact verification, not a hosted Workflow execution test.
- Local setup completed against isolated PostgreSQL databases on loopback. Next development startup generated a PostgreSQL world module. Browser health returned HTTP 200 with `status: ready`. Next's MCP reported no compilation issues, configuration errors or browser session errors. The anonymous homepage rendered. Synthetic gateway credentials used the existing model-catalog fallback; no model turn was submitted.

## Remaining cutover work

1. Validate real managed execution in an isolated Vercel preview with a fresh application database: creation, follow-up, reconnect, billing recovery, delayed work and redeploy continuation. Artifact inspection and mocked tests do not establish these hosted behaviors.
2. Choose a drain or migration strategy for existing PostgreSQL sessions. Changing worlds does not transfer runs, transcripts or checkpoints. Existing application bindings must not be treated as managed-world sessions.
3. Implement and verify provider-supported hosted erasure before claiming deletion parity. Keep the existing rejection until then.

No hosted databases, secrets, deployment settings or production data were changed.
