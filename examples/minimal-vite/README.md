# Bounded Vite / Eve Node / Postgres proof

This is an adapted **actually CLI-generated** selected application for #325,
not a supported starter or deployment promise. It uses published Eve 0.52.1,
AI SDK 7.0.93, OpenAI provider 4.0.59 (`gpt-5-mini`), Vite 7.3.1, React 19.2.3,
Postgres World 5.0.0-beta.40, Node 24.20.0 and PostgreSQL 17.11. The independent
Bun lockfile pins the complete fixture graph. Bun 1.3.11 manages packages/scripts;
Node runs the gateway, Eve/embedded worker and disposable effect receiver.

Source: PR #318 at `1b47cffe692acb8e2ebaf1ebebfa7ec76df75f10` (still open at
pinning); PR #317 at `c686b31bb0fe00e3234eaa92af7f81ed4d172ad7` was recorded but
not integrated. No private Eve patch is used. R06's Node/Postgres setup is reused.

## What changed from the generated Next application

- `app/main.tsx` and `index.html` replace the Next document/page mounting.
- `vite.config.ts` supplies the dev proxy and browser module audit; Next is
  removed from the manifest, lockfile and TypeScript config.
- `server/trpc.ts` and `server/gateway.ts` preserve the generated Fetch handlers;
  the latter receives path segments directly instead of Next route params.
- `server/index.ts` adapts Node HTTP streams to Fetch Request/Response. It
  forwards response chunks with backpressure and propagates disconnects. It
  never exposes Eve raw routes or Workflow callbacks through the app gateway.
- The selected `confirm_note` source was installed through a disposable external
  HTTP registry. Its original schema, inferred output and renderer are retained.
  The local adaptation now calls `lib/confirm-effect.ts`, which sends an
  execution-derived idempotency key (`session.id:callId`) to `server/sink.ts`.
  The receiver is a separate HTTP process and database; no real third-party
  system is modified. It performs an atomic insert/dedupe and payload check.

The projection, inferred tRPC binding/message/tool contracts, caller verifier,
durable conversation/session binding, default-deny gateway policy, Eve channel
ACL, React store ownership, direct JSX layout and lazy tool rendering are reused.
`"use client"` directives are harmless Vite build warnings; they are retained
as source provenance. No `next/*` client import had to be rewritten.

`provenance/` contains the original generated selection and installation receipt,
not a current CLI-managed installation. The loopback registry URL was temporary.
Do not run CLI add against this adapted proof: host-aware generation/updates
remain a separate gap. To reproduce the pre-adaptation generation in a **new**
directory, build the pinned CLI and run
`bun research/framework-evolution/implementation/vite-proof/generate.ts /absolute/new/path`.
The committed fixture itself is runnable without that registry or generation step.

## Run locally

Use disposable infrastructure and verify ports are unused. On this machine,
put `/opt/homebrew/opt/node@24/bin` first on PATH; PostgreSQL helpers default to
`/opt/homebrew/opt/postgresql@17/bin` (override `PG_BIN`).

From this directory:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
# Fill three independent secrets and an authorized OpenAI API key.
bash scripts/postgres-start.sh
bun run db:init
node --env-file=.env.local node_modules/@workflow/world-postgres/bin/setup.js
bun run host:build
node --env-file=.env.local node_modules/eve/bin/eve.js build
```

The helper owns only `.postgres/data`, binds loopback and creates `m29` and
`m29_effects`. `M29_PG_PORT` defaults to 55586; keep all database URLs in sync.
No persistent transcript/history UI is installed. `m29` holds independent app
bindings and Eve/Workflow schemas; the receiver owns `m29_effects.notes`.

In the monorepo, set `CHATJS_DEV_SLOT=287` in root `.env.worktree.local` (or choose
a verified-free slot), run `bun dev:info --json`, then start four root scripts
in separate terminals with Node 24 on PATH:

```sh
bun dev:vite
bun dev:vite-gateway
bun dev:vite-eve
bun dev:vite-sink
```

The observed ports were Vite 5877, app gateway 5876, Eve 5875, receiver 5878.
The Next example and Vite proof share the Eve app offset; do not run both in the
same slot. A slot value is not a machine-wide reservation: independently created
worktrees collided during this proof. Check listeners and coordinate ownership.

For a standalone copy, load `.env.local` and set PORT explicitly per terminal:

```sh
PORT=5877 bun --env-file=.env.local run dev
PORT=5876 node --env-file=.env.local .host/index.js
PORT=5878 node --env-file=.env.local .host/sink.js
node --env-file=.env.local node_modules/eve/bin/eve.js start --host 127.0.0.1 --port 5875
```

The browser needs the host's verified `chatjs_identity` cookie. This fixture has
no public login endpoint; the browser proof mints a test-only HttpOnly cookie
in an isolated Playwright context using `scripts/identity.ts`. Real hosts replace
`lib/identity.ts` with their trusted identity integration. Never expose Eve or
the receiver to browser callers. Mutations require the configured Origin.

## Reproduce runtime evidence

From this directory with services ready (these commands incur provider usage):

```sh
bun --env-file=.env.local scripts/proof.ts prepare
bun --env-file=.env.local scripts/browser-proof.ts prepare
# Stop ONLY this fixture's Eve and gateway; restart them with the same build/DB.
# The recorded final run also restarted its own PostgreSQL cluster while pending.
bun --env-file=.env.local scripts/proof.ts resume
bun --env-file=.env.local scripts/browser-proof.ts resume
bun --env-file=.env.local scripts/authorization-recheck.ts
bun --env-file=.env.local scripts/stream-proof.ts
bun --env-file=.env.local scripts/proof.ts cancel
bun --env-file=.env.local test tests
```

For the receiver crash proof, **stop only this fixture's receiver first**; the
script owns and kills/restarts its own receiver child on `SIDE_EFFECT_ORIGIN`:

```sh
bun --env-file=.env.local scripts/effect-proof.ts
```

It parks a model-driven approval, commits one receiver row while withholding
its HTTP response, kills that receiver with SIGKILL, restarts it and asserts
one row/two-or-more delivery attempts, unchanged execution key and a completed
typed result. A changed payload under the same key must return 409. Eve remains
alive during this fault test; it does not prove Eve crash-at-effect recovery.
Restart the ordinary receiver afterwards for further browser use.

```sh
bun run lint
bun run test:types
bun run client:build
# From repository root:
bun lint
bun test:types
```

`client:build` audits the actual Vite module graph for Next and app server imports
and emits `dist/browser-modules.json`. It also proves the separate lazy renderer
chunk. This is an intentional client portability build, not a typecheck substitute.
Evidence logs/screenshots under `evidence/` are ignored; sanitized results live
in the linked research report. Stop the isolated DB with `bash scripts/postgres-stop.sh`.

## Limits and minimal host seam

The smallest reusable boundary is **Fetch handlers + verified caller + durable
binding**, with a React entry point and host URL configuration. This example
adds a concrete Node adapter, not a universal host abstraction.

The observed Vite dev proxy forwards live SSE correctly. Production static
asset serving, TLS/secure cookies, proxy buffering/disconnects, request limits,
health/readiness/drain, public ingress and multi-replica deployment still need
validation. The Node adapter returns generic 502 on transport failure and has
a bounded request reader; it is intentionally small, not a hardened front door.
The client bundle is about 711 KB (189 KB gzip) despite the lazy renderer.

Session creation can remain `uncertain` after an ambiguous external call and
needs operator reconciliation. Cancellation is cooperative. Eve worker SIGKILL
mid-model/mid-effect, suspended-run dependency upgrades and arbitrary provider
retry policies remain unproven. Receiver idempotency prevents duplicates only
for the same execution key and retained receiver record; it is not global
exactly-once semantics. Existing #315 gates remain independent. A supported
starter still depends on #313/#314 acceptance.
