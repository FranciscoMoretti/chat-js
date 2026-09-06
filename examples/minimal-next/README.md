# Minimal Next + Eve conversation

A standalone source example on **Next 16.3.0, AI SDK 7.0.93 and published Eve
0.52.1**. It supports authenticated create, streamed messages, replay/reconnect,
cooperative cancellation, and durable pending tool approval. `apps/chat` is
unchanged. This independent Bun lockfile prevents a fixture from silently
changing the demo's dependency graph; copy this directory to run independently.

## Setup

Requires Bun 1.3.11, **Node 24+**, PostgreSQL 17, and an OpenAI API key with access
to `gpt-5-mini`. Use a fresh disposable database. On this machine the tested
Node binary is `/opt/homebrew/opt/node@24/bin/node` and PostgreSQL lives under
`/opt/homebrew/opt/postgresql@17/bin`. Do not run Eve's server with Bun.

From this directory:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
# Fill the two independent secrets and authorized provider key in .env.local.
# For example, generate each secret separately with: openssl rand -hex 32
bash scripts/postgres-start.sh
bun run db:init
node --env-file=.env.local node_modules/@workflow/world-postgres/bin/setup.js
node --env-file=.env.local node_modules/eve/bin/eve.js build
```

The Postgres helper is macOS-specific; set `PG_BIN` for another installation.
`M07_PG_PORT` defaults to 55479; update both database URLs if changing it. Its
trust-authenticated database binds **only to loopback** and is for disposable
local development. It never touches another worktree's database. Stop it with
`bash scripts/postgres-stop.sh`. For an existing Postgres installation, create a
fresh `m07` database yourself and omit these helpers. Eve/Workflow's supported
bootstrap owns the `workflow`/worker schemas. `db:init` owns only the
`chatjs.conversations` table; it does not read private Eve tables.

In the monorepo, choose a free `CHATJS_DEV_SLOT` in root `.env.worktree.local`,
run `bun dev:info --json`, then use two terminals with Node 24 first on PATH:

```sh
bun dev:minimal-eve
bun dev:minimal
```

Offsets 4 and 5 select Next and Eve without colliding with chat/docs/site.
The tested slot 79 maps to Next 3794 and Eve 3795. For standalone execution,
set the two origins in `.env.local`, then run in separate terminals:

```sh
node --env-file=.env.local node_modules/eve/bin/eve.js start --host 127.0.0.1 --port 3795
PORT=3794 bun run dev
```

Only expose **Next** to application callers. Eve's loopback listener contains
Workflow callback endpoints with their own token semantics; it is an internal
worker service, not a public reverse-proxy target. Deploying this recipe or
exposing callback routes through a public ingress requires its own validation.
No deployment was performed.

## Application-supplied identity

`lib/identity.ts` is the replacement seam for the host's verified caller. The
example verifies HS256 tokens with issuer `chatjs-host`, audience
`chatjs-minimal`, a subject and an expiry. It accepts a bearer token or the
`chatjs_identity` cookie. The host should supply a Secure, HttpOnly, SameSite
cookie over HTTPS; no login page or identity database is installed.

For local browser verification only, `scripts/browser-identity.ts` writes a
one-hour signed identity into an ignored, mode-0600 curl import file. Run it
with the same `APP_IDENTITY_SECRET` and `APP_ORIGIN` as Next, then import using
agent-browser's `cookies set --curl evidence/identity.cookies`. This harness is
not an HTTP endpoint. Do not publish the file or either server secret. Real
hosts replace this harness with their own identity integration.

All mutations require `Origin` to equal `APP_ORIGIN`, including bearer API
clients. Neither the owner header nor a raw session ID authenticates a caller.
The public gateway drops all incoming identity/forwarding headers and stamps a
server-only credential plus the verified owner. Eve independently verifies that
credential and the database owner binding for permitted session operations.

## Durable binding and recovery

The tRPC `conversation.create` mutation takes `{operationId: UUID, message: string}` and returns
`{conversationId, sessionId}` only after the durable owner binding is committed.
The operation key is scoped to the **verified owner**. Matching completed retries
return the same binding. Concurrent duplicate requests get 409 while creation is
in progress; a changed payload also gets 409. Different owners never share an
in-flight operation, even if they submit the same operation UUID.

A reservation commits before the external Eve call. If the process crashes or
the response/binding write becomes ambiguous, the row stays `creating` or
`uncertain` and retries fail closed. It is **not** safe automatic distributed
create-once recovery. Do not clear that reservation and resend, or invent a
replacement session ID. An operator must reconcile it against the external
execution. Eve's public `operationId` is passed, but its check-then-create
behavior is not claimed as atomic across processes. No private patch is used.
The first request text is retained for exact retry comparison; optional saved
history UI/transcript tables are not installed.

The tRPC `conversation.resolve` query resolves only the current owner's binding.
The Eve-compatible gateway allows only existing-session send/respond, stream,
and turn-ID cancellation. Clear, compact, reset, subagents, callbacks and unknown
future routes are denied by default. Raw Eve paths on Next have no handler.

The URL retains the conversation ID. Reload creates a fresh Eve React store at
cursor zero and rebuilds its projection from durable events. A saved projection
must pair its event prefix with the matching `session.streamIndex` returned by
`ClientSession.snapshot()`. An optimistic approval click does not remove pending
input: only `input.resolved` does.

**Cancellation is cooperative.** The tested Postgres runtime can finish its
active model step before emitting `turn.cancelled`; this is not immediate
provider-request abortion or rollback of side effects. A fresh replay can be
needed to observe that late event after a response stream reaches its waiting
boundary. After a worker/network interruption, use Reconnect to rebuild the
projection. Already-completed external effects are outside this example.

## Validation

With both services running and the environment loaded, from the repo root:

```sh
bunx dotenv -e .env.worktree.local -e examples/minimal-next/.env.local -- bun run worktree-env minimal -- bun examples/minimal-next/scripts/proof.ts prepare
# Stop only this example's Eve process with Ctrl-C, then restart it.
bunx dotenv -e .env.worktree.local -e examples/minimal-next/.env.local -- bun run worktree-env minimal -- bun examples/minimal-next/scripts/proof.ts resume
bunx dotenv -e .env.worktree.local -e examples/minimal-next/.env.local -- bun run worktree-env minimal -- bun examples/minimal-next/scripts/proof.ts cancel
bunx dotenv -e examples/minimal-next/.env.local -- bun run --cwd examples/minimal-next test
bun run --cwd examples/minimal-next lint
bun run --cwd examples/minimal-next test:types
bun lint
bun test:types
```

`prepare` asserts 28 HTTP authorization checks and parks a real approval.
`resume` proves stable replay IDs, recovered pending input, a validated typed
result and continuation. `cancel` asserts acceptance and a durable cancellation
on fresh replay. These scripts call a real provider and incur normal usage.
The database tests cover concurrent caller isolation, matching/mismatched
retries and ambiguous external creation. They never delete database records.

## Selected inventory and downstream contracts

Direct runtime packages (all exact pins in `package.json`/`bun.lock`):

| Package | Purpose |
| --- | --- |
| next, react, react-dom | Next UI and routes |
| @trpc/client, @trpc/server | Typed application queries/mutations |
| eve, ai | Durable execution and public typed frontend store |
| @ai-sdk/openai | This example's selected model implementation |
| @workflow/world-postgres, postgres | Explicit execution storage and independent application bindings |
| jose | Example host identity verifier |
| zod | Browser-safe project contract validation |

The clean install resolved 179 packages including dev/transitive dependencies.
Eve vendors framework tools/providers internally; the Node build was 19.1 MB
(3.96 MB gzip). This is not a claim that every Eve internal dependency disappears.
No Files SDK, Redis, sandbox, editor, catalog, Better Auth, saved-history UI,
thread tree, or full-demo package was added by this example.

CLI/registry consumers should materialize only this selected source graph using
the existing shadcn/Eve installer architecture. This example defines no registry,
package manager, capability catalog or version resolver. Host identity, database
and model integrations are ordinary replaceable project-local source seams;
external choices must be able to supply those same requirements.

Functional UI consumers own `app/chat.tsx` presentation and consume
`lib/projection.ts` (`ProjectData`, `ProjectMessage`, `projectReducer`) through
public `useEveAgent<ProjectData>`. The explicit generic avoids selecting Eve's
default-message overload. `lib/note-contract.ts` supplies inferred input/output
shared by `agent/tools/confirm_note.ts` and the renderer. Mounted identity is
explicitly `confirm_note`; do not use an ambiguous global tool-name union.
Messages remain a derived Eve projection, not a second writable transcript.
The Eve React hook owns stream attachment/cleanup; a new session remounts it.
