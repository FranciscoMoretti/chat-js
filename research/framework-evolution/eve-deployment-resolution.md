# Establish the supported Eve deployment path outside Vercel

Research resolution, 2026-09-05. [Decision ticket](https://github.com/FranciscoMoretti/chat-js/issues/285).

## Answer and evidence level

A credible, documented candidate is **Eve 0.52.1 on Node 24.20.0, with its bundled Workflow core 5.0.0-beta.48 and installed official Postgres World 5.0.0-beta.40, running as a long-lived Node/container service**. Keep the Vite React frontend separate from agent hosting. This establishes documented feasibility and a pinned experiment candidate, **not a deployment tested by ChatJS**. No service was installed, built, started, or deployed during this investigation.

Bun remains the repository's package/script tool. Eve's published package declares Node `>=24`; nothing in this investigation establishes Bun runtime support. Use the documented Node execution path for the experiment.

## Published-versus-main verification

The npm registry was queried directly, and the published Eve and Postgres World tarballs were inspected in memory without executing package code.

| Component | Exact evidence | Implication |
| --- | --- | --- |
| Eve | Published npm `latest` is `0.52.1`; engines `node >=24`; direct Nitro dependency `3.0.260903-beta` | The earlier main-only version observation is now confirmed as published |
| Eve bundled Workflow | Published tarball `dist/src/compiled/@workflow/core/version.d.ts` declares `5.0.0-beta.48` | Eve vendors Workflow; adding arbitrary `workflow@latest` does not select Eve's runtime |
| Workflow standalone | npm `latest = 4.8.5`, `beta = 5.0.0-beta.48` | Bare `latest` is on the wrong major line for this Eve release |
| Postgres World | npm `latest = 4.3.5`, `beta = 5.0.0-beta.40`; beta depends on `@workflow/world 5.0.0-beta.33` | Pin the beta package explicitly; matching release line does not mean every package shares one beta suffix |
| Eve source configuration | Pinned Eve workspace specifies `@workflow/world-postgres: 5.0.0-beta.40` | Independent upstream evidence for this exact candidate pairing |
| Node | Official distribution index reports Node `v24.20.0`, released 2026-08-26, LTS Krypton | Concrete Node patch candidate satisfying Eve's engine requirement |
| AI SDK | Eve's published peer range is `ai ^7.0.82`; ChatJS currently specifies `6.0.244` | Isolate the proof from the existing app's dependency graph; do not silently treat adoption as an AI SDK 6-compatible transport change |

Primary sources: [Eve version metadata](https://registry.npmjs.org/eve/0.52.1), [Eve published tarball](https://registry.npmjs.org/eve/-/eve-0.52.1.tgz), [Workflow 5 beta metadata](https://registry.npmjs.org/workflow/5.0.0-beta.48), [Postgres World metadata](https://registry.npmjs.org/@workflow/world-postgres/5.0.0-beta.40), [Node distribution index](https://nodejs.org/dist/index.json), [pinned Eve workspace](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/pnpm-workspace.yaml), [ChatJS manifest at research baseline](https://github.com/FranciscoMoretti/chat-js/blob/c8101f20/apps/chat/package.json).

Integrity recorded from npm metadata:

- Eve 0.52.1: `sha512-XluSIAcUy/Gtwqje5Vpv0EbNhDohwZYjcpeWCrm9pyeS5auvNYsWcLQfGxcpRa65VXRn/Sj19v//p4hUDYaWEQ==`
- Postgres World 5.0.0-beta.40: `sha512-zj1pVYvsfCciEXTVJMMzE4ogHV1e/bq1E6pOehKf+ZVevJJp1Fbl7rYXxsABTFJNen0I10mCihR7iTpbKsq5gA==`

The published Eve tarball includes the self-hosting guide, which explicitly identifies the Workflow `5.0.0-beta` line and runtime rejection of incompatible protocols. Source inspection also shows protocol changes involve event identity and replay ordering, not just TypeScript interface compatibility. Thus this is an upstream-aligned pairing to test; successful protocol startup and replay remain experimental acceptance criteria. [Self-hosting guide](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/deployment/self-hosting.md), [World protocol upgrade guide](https://github.com/vercel/workflow/blob/c1293329230c13be98e6c9e1bda87521cb50d9d3/docs/content/worlds/v5/upgrading-to-v5.mdx).

## Operations and compatibility matrix

| Concern | Documented path | Constraint / proof still needed |
| --- | --- | --- |
| Runtime | `eve build`, then `eve start`, generated Nitro `.output` | Node 24 candidate; Bun runtime unverified |
| Durable World | Installed `@workflow/world-postgres` selected through `experimental.workflow.world` | Protocol must be accepted by Eve's bundled runtime |
| Database | Bootstrap Workflow tables in PostgreSQL | Pin database image/digest and check migration permissions in experiment |
| Queue | Long-lived graphile-worker polling; startup subscription required | Verify Eve initializes this World on service startup; no serverless freeze/termination assumption |
| Shutdown | Coordinate World close, HTTP server, pool; active jobs can be retried | Tools must tolerate at-least-once execution; exact-once external effects not guaranteed |
| Reverse proxy | Preserve `/eve/` and `/.well-known/workflow/` | Callback reachability and unbuffered stream delivery must be exercised |
| App identity | App authenticates user and authorizes session access; Eve route auth verifies callers | Define trusted principal propagation; generic route auth alone is not per-conversation authorization |
| Model | Direct AI SDK provider object with credentials, or gateway with API key | Non-Vercel hosting need not use a Vercel gateway |
| Sandbox | Docker, microsandbox, custom backend, or hosted Vercel sandbox if explicitly selected | Choose one only when needed; local backend availability is not automatically production isolation |
| Schedules | Standard Eve build/start path runs Nitro schedules | Custom HTTP-only targets need explicit scheduler integration |
| Browser replay/HITL | Eve's client/session APIs are the intended path | Restart, reconnect, replay ordering, approval ownership and cancel behavior untested here |
| Multiple replicas | Durable backing storage supplies necessary foundation | Load balancing, concurrency, shutdown and authorization need a separate operational test |

Sources for service/routing/auth/model/sandbox/schedules: [version-matched Eve self-hosting guide](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/deployment/self-hosting.md). Sources for database/queue/shutdown: [official Postgres World guide](https://github.com/vercel/workflow/blob/c1293329230c13be98e6c9e1bda87521cb50d9d3/docs/content/worlds/v5/postgres.mdx). The latter is pinned source documentation, not a claim that the deployment has run successfully.

## Local World and serverless boundaries

The Postgres World guide describes the adapter as production-ready but requires a long-lived process, bootstrap, and worker startup. It explicitly excludes serverless platforms and Vercel deployments. Running a persistent container on another cloud is the appropriate first target.

The Local World guide explicitly limits it to development: JSON filesystem persistence, an in-memory queue, single-instance operation, and no built-in authentication. Although Eve's self-hosting guide suggests mounting local state, mounting a directory is insufficient evidence for a production durable deployment. Use Local World for development and Postgres World for the planned production-shaped proof. [Local World guide](https://github.com/vercel/workflow/blob/c1293329230c13be98e6c9e1bda87521cb50d9d3/docs/content/worlds/v5/local.mdx)

Current ChatJS Redis resumption reconnects response delivery; that is a different promise from restarting agent computation after worker death. The new proof must test durable work and pending approvals, not only browser reload. Existing code evidence and broader portability analysis remain in [Portability research](https://github.com/FranciscoMoretti/chat-js/blob/c8101f20/research/framework-evolution/portability.md).

## Smallest later acceptance experiment

This is proposed prototype work, not work performed or authorized by this factual investigation.

1. Create an isolated Vite React client and Eve service using the exact candidate pins above; record lockfile, Node version, Postgres image digest and World protocol acceptance. Do not upgrade the existing Next application as a prerequisite.
2. Use one direct provider and one deterministic tool that asks for approval. Start with no sandbox dependency unless the chosen tool requires one. Give the test two users with separate sessions and enforce their ownership.
3. Bootstrap PostgreSQL and verify the World worker starts with Eve. Run behind a proxy forwarding both prefixes. Record one completed turn and trace IDs.
4. Disconnect the browser during output and reconnect: verify stable IDs, no duplicated text/tool cards, and complete replay.
5. Suspend at approval, stop and restart the Node service, reload the client and approve. Verify resumed work lands in the correct session and unauthorized access fails.
6. Interrupt a tool around a side effect using an idempotency key; demonstrate retry behavior without duplicated effects. Keep the failure case visible rather than treating a lost connection as success.

Passing that experiment would justify a **tested single-service non-Vercel recipe**. It would not establish serverless, Bun-runtime, arbitrary sandbox, multi-region, every database, or seamless upgrade compatibility. A subsequent operational experiment should cover multiple replicas and deployment replacement while runs are suspended.

## Remaining decisions

- How ChatJS's existing identity authorizes Eve sessions and how browser credentials reach the service.
- Whether the initial supported recipe is a single container plus PostgreSQL, and which provider hosts the demonstration.
- How existing AI SDK 6/thread semantics migrate to Eve's AI SDK 7-era execution model.
- Who owns persisted conversation history versus execution history, including branch/run/tool identity.
- What release-upgrade policy protects suspended runs across Eve/Workflow beta changes.

These decisions do not prevent resolving this investigation: the documented non-Vercel path, candidate version tuple, operational constraints and proof requirements are established.
