# ChatJS framework evolution: infrastructure and host portability

Research date: 2026-09-05. Planning evidence, not implemented support. No deployments or runtime compatibility tests were performed.

## Recommendation

Make portability mean **the application and agent definitions survive changing deployment providers**, with explicit installation choices and a tested operational recipe. Do not promise every database, JavaScript runtime, framework, and workflow engine as an interchangeable combination.

The strongest first proof is a **Vite React client consuming the same ChatJS contracts, with Eve running as a Node service using the official Postgres World**. Keep the current Next.js application. This tests two separate propositions: reusable UI without Next, and durable agents without Vercel. TanStack Start is a good subsequent full-stack recipe; Electron deserves a separate product decision because a remote website wrapper and a local-first desktop application have substantially different requirements.

These are recommendations/inferences from the evidence below, not resolved project decisions.

## Source snapshot

- ChatJS checkout: `8422c767f30a7586beb5d511ef12e88b1a29e845`. `apps/chat/package.json` specifies AI SDK `6.0.244`, Next `16.3.0`, React `19.2.3`, tRPC `^11.1.2`, TanStack Query `^5.80.3`, Zustand `^5.0.6`, files-sdk `2.1.0`, resumable-stream `2.2.10`, Better Auth `^1.5.6`, and Drizzle `^0.45.1`. These are manifest values, not a claim about resolved lockfile versions.
- Eve main: [`e6037391160b493e395f46a226878fc81ae1a1c0`](https://github.com/vercel/eve/tree/e6037391160b493e395f46a226878fc81ae1a1c0). Its package manifest reports `eve` `0.52.1` and direct dependency `nitro` `3.0.260903-beta`. Main is not synonymous with latest published npm release. [Manifest](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/package.json)
- Workflow main: [`c1293329230c13be98e6c9e1bda87521cb50d9d3`](https://github.com/vercel/workflow/tree/c1293329230c13be98e6c9e1bda87521cb50d9d3). The source tree contains both v4 and v5 World documentation. Match the Eve release's Workflow protocol line, rather than copying an older blog example.
- TanStack Start's current overview describes it as release candidate, feature-complete with a stable API, while explicitly acknowledging remaining bugs. [Overview](https://tanstack.com/start/latest/docs/framework/react/overview)

## Existing ChatJS boundaries

The thread package is a useful headless boundary, but **framework-independent does not mean execution-engine-independent**. `AbstractThread` owns tree orchestration; `ThreadRunChat` extends AI SDK `AbstractChat`, and the documented compatibility rule is a strict behavioral superset of `useChat`. Eve adoption must deliberately revise or adapt this contract. It is not simply a transport URL swap. [Thread architecture](../../packages/thread/ARCHITECTURE.md)

The application has real host coupling:

| Concern | Evidence | Consequence |
| --- | --- | --- |
| Request context | `apps/chat/trpc/init.ts` imports `next/headers` and React `cache`; resolves Better Auth session internally | Extract a request/principal input boundary before relocating the router |
| Model/MCP caches | `apps/chat/lib/ai/models.ts`, `app-models.ts`, `mcp/cache.ts` use `next/cache` | Need explicit cache semantics and invalidation, not only a key/value client |
| Streaming lifetime | `apps/chat/app/(chat)/api/chat/route.ts` uses Redis clients and `createResumableStreamContext({ waitUntil: after })` | Current streaming depends on Next request lifecycle plus optional Redis |
| Database | `apps/chat/lib/db/client.ts` directly constructs postgres-js and Drizzle from `DATABASE_URL` | PostgreSQL hosting is portable; database dialect is not yet abstracted |
| Authentication | `apps/chat/lib/auth.ts` uses Better Auth, PostgreSQL Drizzle adapter, `nextCookies`, Vercel preview URLs, Electron plugin | Session identity can be shared, while request/cookie/origin integration remains host-specific |
| Files | `apps/chat/lib/storage-provider.ts` is already rewritten by CLI with selected files-sdk provider | Strong existing pattern for selecting an implementation and its dependency |
| Desktop | `apps/electron/README.md` documents loading configured deployed app URL | This proves a wrapper, not packaged offline UI, local execution, or local persistence |

## Eve self-hosting is concrete, with operational conditions

Eve documents `eve build` followed by `eve start`, producing a Nitro `.output` server. Model access can use a direct AI SDK provider instead of a Vercel gateway. Its self-hosting guide supports configured Workflow Worlds and local/custom sandbox backends. A reverse proxy must forward **both** `/eve/` and `/.well-known/workflow/`; omitting callbacks can leave runs stalled. Route authentication, scheduled tasks, and production process management remain deployment responsibilities. The guide says the current World protocol line is `5.0.0-beta`, rejects incompatible versions, and exposes configuration under `experimental.workflow`. [Self-hosting guide](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/deployment/self-hosting.md)

The implication is encouraging: Eve can be an opinionated execution engine without requiring Vercel hosting. However, the host preset, callback routing, queue lifecycle, sandbox, and World version must be tested together. Nitro's deployment abstraction alone does not prove all Eve capabilities work in all Nitro targets.

## Workflow Worlds: distinguish portability from operational equivalence

The official Postgres World uses PostgreSQL storage, graphile-worker jobs, and Postgres notifications for streaming. Its v5 guide explicitly describes it as production-ready and suitable for long-running containers/VMs. It needs schema bootstrap and `world.start()` at server startup. It is **not compatible with serverless platforms or Vercel deployment**. Shutdown coordination and handler tolerance for at-least-once execution are documented. Worker concurrency and database connections are capacity decisions, not invisible implementation details. [Postgres World v5 guide](https://github.com/vercel/workflow/blob/c1293329230c13be98e6c9e1bda87521cb50d9d3/docs/content/worlds/v5/postgres.mdx)

The Local World persists JSON files and recovers active runs, but its guide explicitly limits it to development: queue messages are in memory, it is single-instance, and it supplies no authentication. Eve's mounted-local-data suggestion must not become ChatJS's distributed production recipe. Persistent files alone do not imply a durable distributed queue. [Local World v5 guide](https://github.com/vercel/workflow/blob/c1293329230c13be98e6c9e1bda87521cb50d9d3/docs/content/worlds/v5/local.mdx)

The official manifest distinguishes Local, Postgres, and Vercel Worlds from community implementations, including Redis, Turso, MongoDB, Cloudflare, and others. Listing is not our verification of a particular version or feature. Prefer an officially maintained Postgres deployment for the initial portability proof. [Worlds manifest](https://github.com/vercel/workflow/blob/c1293329230c13be98e6c9e1bda87521cb50d9d3/worlds-manifest.json)

World v5 changes include contract and event-allocation behavior beyond TypeScript signature compatibility. A package that structurally satisfies an interface can still violate replay ordering. ChatJS should inherit and pin compatible Eve/Workflow releases, rather than creating its own universal durability wrapper. [World upgrade guide](https://github.com/vercel/workflow/blob/c1293329230c13be98e6c9e1bda87521cb50d9d3/docs/content/worlds/v5/upgrading-to-v5.mdx)

## Redis resumption and durable execution solve different problems

Current ChatJS conditionally creates a resumable stream context when Redis exists. Its reconnect route resumes `activeStreamId`, or returns a finalized database message; with no context it returns 204. This is evidence for reconnecting a response stream, not a mechanism that restarts interrupted agent computation. [Chat route](../../apps/chat/app/(chat)/api/chat/route.ts), [resume route](../../apps/chat/app/(chat)/api/chat/[id]/stream/route.ts)

Design inference: distinguish three promises explicitly:

1. **Live delivery:** chunks reach connected clients.
2. **Replay:** reconnecting clients recover missed persisted output without duplicates.
3. **Durable execution:** work, waits, and approvals survive process death and restart.

A Redis-backed World can in principle provide all three; Redis pub/sub or resumable transport alone does not establish the latter two. Do not require Redis because the current app does. If the selected World handles execution and replay, a separate Redis dependency should be justified by a separate need such as distributed rate limiting.

## Portability layers to define

Proposed boundaries, not proposed package names:

| Layer | Responsibility | What should remain outside |
| --- | --- | --- |
| Domain | Conversations, branches, messages/artifacts, attachment references, identity references | Next requests, database drivers, provider credentials |
| React composition | Scoped state, commands/selectors, layout and renderer conventions | Global singleton assumptions and direct host imports |
| Execution | Session/run lifecycle, approvals, cancel/reconnect/replay, tool execution | Application account and billing models |
| Application services | Authorization, conversation listing, metadata, settings, file access | Assumption that the browser hook is the durable source of truth |
| Host integration | Request context, routes, cookies, static assets, build and lifecycle | Domain semantics |
| Deployment recipe | World, worker startup, database, sandbox, observability, ingress | Promise that any chosen combination will work |

Use adapters at boundaries with meaningful independent ownership. Avoid abstracting everything behind generic interfaces before two implementations expose the actual differences.

## tRPC helps, but does not erase server boundaries

The tRPC Fetch adapter accepts native `Request` and returns `Response`, using standard web APIs. This is a practical route-level seam across hosts. [tRPC Fetch adapter](https://trpc.io/docs/server/adapters/fetch)

Recommendation: share router/domain code, construct context from the actual request and injected services, and share client-facing types through type-only exports. Keep tRPC for application queries and mutations where useful; do not force Eve's stream/approval protocol through tRPC solely for uniformity. Cross-origin cookies, principal propagation to Eve, authorization to a specific session, and API version compatibility still need concrete design. Strong compile-time typing does not authorize an HTTP request or validate arbitrary external input.

## Database, authentication, cache, and storage

**Database:** portable PostgreSQL is a smaller, immediately valuable commitment than portable database dialects. Existing queries/schema use PostgreSQL; Better Auth supporting additional Drizzle providers does not migrate application SQL. Recommend one supported relational schema initially, with provider-neutral connection configuration. Application data and Workflow data have different ownership and migrations even if they share a PostgreSQL server. [Local client](../../apps/chat/lib/db/client.ts), [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)

**Authentication:** expose a trusted principal and authorization policy to core services. Let the starter choose Better Auth. An existing app should supply its identity integration without installing a second account system. App login, Eve route auth, and sandbox credentials are three different concerns.

**Cache:** distinguish browser Query cache, server memoization, shared cache, rate limits, and durable logs. A null/no-cache implementation can preserve correctness for some reads; it cannot silently replace distributed rate limiting or durable state. Specify freshness/invalidation and failure behavior before promising backend interchangeability.

**Storage:** build on files-sdk. Object bytes, app attachment metadata, sandbox files, and workflow event storage should not be collapsed into one adapter. Provider selection needs an installation boundary; runtime feature flags do not remove packages.

## Second-host comparison

| Choice | What it proves | Added complexity | Recommendation |
| --- | --- | --- | --- |
| Next.js self-hosted | Deployment-provider independence | Process/cache/ingress operations | Useful early production recipe; does not prove UI framework independence |
| Vite React + separate Eve service | Browser/UI independence from Next and explicit backend boundary | Auth/proxy routing, two development processes, API endpoint configuration | Best minimal architecture proof |
| TanStack Start | Full-stack portability to a second framework | Router conventions, server integration, deployment configuration | Best next complete starter if demand supports it |
| Electron remote wrapper | Desktop packaging/auth around existing site | Signing/updating/deep links | Existing direction, limited proof |
| Electron packaged/local-first | Independent desktop product with optional local execution | IPC, local auth/secrets, runtime lifecycle, persistence, sandbox availability | Later dedicated decision |

Vite can emit static files; `vite preview` is not a production server. A Vite client needs a deployed backend for the agent and application services. [Vite deployment guide](https://vite.dev/guide/static-deploy.html)

TanStack Start combines TanStack Router with SSR, server functions, and server routes; its own documentation says Router alone may suffice when those server features are unnecessary. This supports choosing the second host based on the proof sought, rather than replacing Next on fashion grounds. [Start overview](https://tanstack.com/start/latest/docs/framework/react/overview)

Next itself supports self-hosting, including streaming with suitable proxy configuration and coordinated cache handling for multiple instances. Retaining Next does not require Vercel. [Next self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

Electron deliberately separates renderer and privileged APIs through isolation/preload mechanisms. A browser-safe ChatJS UI is a useful foundation, but it does not by itself provide safe local tool execution. [Electron security model](https://www.electronjs.org/docs/latest/tutorial/security)

## Proofs needed before public support claims

These are proposed acceptance scenarios for later planning, not tasks created or tests run:

- Run the same typed tool with a rich lazy renderer in Next and a Vite client, without changing its domain definition.
- Complete an authenticated conversation on a non-Vercel Node deployment with Postgres World and direct model-provider credentials.
- Disconnect/reload while streaming; observe coherent replay and stable message/run/tool IDs.
- Restart the server during an approval wait; approve after restart; ensure the intended branch resumes once.
- Kill a worker around a tool side effect; demonstrate idempotency/retry behavior and honest UI state.
- Roll out a new deployment with a suspended old run; establish compatibility/version-routing behavior rather than assuming it.
- Run multiple service replicas and two clients viewing one session; establish ordering, authorization, and cancellation semantics.
- Generate a minimal app without PDF/editor/unused gateway packages; inspect installed dependencies and output chunks separately.
- Start with an existing app's identity system; authorize Eve session access without adding duplicate login/account tables.

## High-level discussion to have next

1. Does the first portability promise cover different cloud providers with PostgreSQL, or also changing database families? Recommend cloud portability first.
2. Is the second host an architectural fixture or a fully maintained starter? Recommend fixture first, then promote based on evidence.
3. Which subsystem owns the permanent conversation record versus the durable execution record? Avoid dual writable message histories without a reconciliation contract.
4. Does “any AI app” mean agentic chat/workspace applications first, or include unrelated AI batch/data products immediately? Keep the north star broad and the first complete journeys specific.
5. Does desktop mean access to the hosted product or local-first execution? Neither follows automatically from the other.
6. What is the support vocabulary: officially tested recipe, community adapter, or possible via extension? State that distinction in the builder and docs.
