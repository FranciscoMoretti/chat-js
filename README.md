<div align="center">

<img src="apps/chat/app/icon.svg" alt="ChatJS" width="64" height="64">

# ChatJS

Stop rebuilding the same AI chat infrastructure. ChatJS gives you a production-ready foundation with authentication, 120+ models, streaming, and tools so you can focus on what makes your app unique.

[**Website**](https://chatjs.dev) · [**Live Demo**](https://demo.chatjs.dev) · [**Documentation**](https://chatjs.dev/docs)

![DemosOnly](https://github.com/user-attachments/assets/f12e89dd-c10c-4e06-9b1a-a9fbd809d234)

</div>

<br />

## CLI

Create a new ChatJS app:

```bash
npx @chat-js/cli@latest create my-app
```

The CLI walks you through gateway, features, and auth choices, generates `chat.config.ts`, and lists the env vars required by your selections.

## Features

- **120+ Models**: Claude, GPT, Gemini, Grok via one API
- **Auth**: GitHub, Google, anonymous. Ready to go.
- **Attachments**: Images, PDFs, docs. Drag and drop.
- **Resumable Streams**: Continue generation after page refresh
- **Branching**: Fork conversations, explore alternatives
- **Sharing**: Share conversations with public links
- **Web Search**: Real-time web search integration
- **Image Generation**: AI-powered image creation
- **Code Execution**: Run code snippets in sandbox
- **MCP**: Model Context Protocol support
- **Desktop App**: Package as a native macOS, Windows, or Linux app with Electron

## Stack

- [Next.js](https://nextjs.org) - App Router, React Server Components
- [TypeScript](https://www.typescriptlang.org) - Full type safety
- [AI SDK](https://ai-sdk.dev/) - The AI Toolkit for TypeScript
- [AI Gateway](https://vercel.com/ai-gateway) - Unified access to 120+ AI models
- [Better Auth](https://www.better-auth.com) - Authentication & authorization
- [Drizzle ORM](https://orm.drizzle.team) - Type-safe database queries
- [PostgreSQL](https://www.postgresql.org) - Primary database
- [Redis](https://redis.io) - Caching & resumable streams
- [Vercel Blob](https://vercel.com/storage/blob) - Blob storage
- [Shadcn/UI](https://ui.shadcn.com) - Beautiful, accessible components
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [tRPC](https://trpc.io) - End-to-end type-safe APIs
- [Zod](https://zod.dev) - Schema validation
- [Zustand](https://zustand.docs.pmnd.rs/) - State management
- [Motion](https://motion.dev) - Animations
- [t3-env](https://env.t3.gg) - Environment variables
- [Pino](https://getpino.io) - Structured Logging
- [Langfuse](https://langfuse.com) - LLM observability & analytics
- [Vercel Analytics](https://vercel.com/analytics) - Web analytics
- [Biome](https://biomejs.dev) - Code linting and formatting
- [Ultracite](https://ultracite.ai) - Biome preset for humans and AI
- [Streamdown](https://streamdown.ai/) - Markdown for AI streaming
- [AI Elements](https://elements.ai-sdk.dev/overview) - AI-native Components
- [AI SDK Tools](https://ai-sdk-tools.dev/) - Developer tools for AI SDK

## Monorepo Layout

- `apps/site`: Landing page ([chatjs.dev](https://chatjs.dev))
- `apps/chat`: Next.js chat app ([demo.chatjs.dev](https://demo.chatjs.dev))
- `apps/docs`: Blume docs ([chatjs.dev/docs](https://chatjs.dev/docs))
- `packages/cli`: interactive scaffold CLI

## Development

- `bun dev`: run chat app
- `bun dev:info`: print this worktree's assigned app URLs
- `bun dev:docs`: run docs
- `bun lint`: run workspace lint
- `bun test:types`: run chat app typecheck

Set `CHATJS_DEV_SLOT` in `.env.worktree.local` to reserve a stable range of ten
ports per worktree. Within each range, chat uses offset `0`, Electron uses `1`,
and the site uses `2`, as configured in `.worktree-env.json`. The local file is
ignored by Git and kept separate from Vercel-managed `.env.local`. Run
`bun dev:info` instead of assuming a port.

### Native Eve development flow

With `EVE_ENABLED=true` in development, `/` and `/chat/[id]` use
`useEveAgent` and a private Eve worker. `/agent` redirects to the normal routes. Eve owns
the durable transcript, approvals and execution. ChatJS authenticates requests
and stores conversation ownership, creation intent, the Eve session ID, and a
usage ledger keyed by durable event ID.
The worker uses the selected ChatJS gateway/model. The sidebar lists and searches
Eve conversations only. Legacy ChatJS conversations remain untouched and are not
shown or imported in this mode. Registered users retain project organization;
guests use their own isolated conversation history.

Use Node 24+ for Eve and Bun for package scripts. Set `EVE_ENABLED=true`, a random
`EVE_GATEWAY_SECRET` of at least 32 characters, and isolated local Postgres URLs
for `DATABASE_URL` and `WORKFLOW_POSTGRES_URL` in `.env.worktree.local`.
Apply ChatJS migrations, initialize the Workflow World, and install the local
provider's deletion fences and retirement receipts before starting the app:

```sh
bunx dotenv -e .env.worktree.local -e .env.local -- bun db:migrate
bunx dotenv -e .env.worktree.local -e .env.local -- node node_modules/@workflow/world-postgres/bin/setup.js
bun eve:db:setup:local
bun dev
```

The provider setup command is idempotent and refuses remote database URLs.
It is an explicit migration; request handlers never install provider tables.
Normal development starts ChatJS and Eve together with `withEve`; no separate
worker command is needed. Browsers use authenticated same-origin ChatJS routes.

Local acceptance covers guest and registered conversations, model comparisons,
editing/regeneration with version navigation, reload, cancellation, and family
deletion. Guest generations reserve message quota before native admission;
retries reuse operation identities and do not debit quota twice. Incomplete
creation or deletion retains recovery state rather than claiming success.

Model costs are recorded by the worker hook and repaired from authoritative
session snapshots before new work. Replaying an event does not charge twice;
charges round up to cents per turn. Completed usage with an unknown cost blocks
new admission until provider evidence is reconciled. Failed-step costs remain
unresolved evidence. The positive-credit check permits in-progress overspend;
it is not a hard budget reservation. Approval responses and cancellation remain
available at zero credits.

Eve is disabled in production even when the flag is set. Production cutover
requires review. Full feature parity and lifecycle recovery remain under active
validation; the local acceptance checks are not a production-readiness claim.
Historical conversation import is intentionally deferred.

Use isolated local databases for acceptance testing. Browser tests use development
login or guest credentials and save sanitized captures under
`apps/chat/tests/eve-results`. For example, with the app running and valid model
credentials, run the guest lifecycle check from the repository root:

```sh
bunx dotenv -e .env.worktree.local -e .env.local -- bun run worktree-env chat -- sh -c 'cd apps/chat && bunx playwright test --config playwright.eve-live.config.ts eve-guest-lifecycle.e2e.ts'
```

Database contracts use `apps/chat/vitest.eve.config.ts`. Each suite checks its
configured database before writing fixtures. Prefer local Postgres and cheap
models for repeated acceptance runs.

## Releases

Releases are driven by Changesets for the whole repository.

- Add a changeset for each releasable package you change.
- Merge the generated version PR from the Changesets workflow.
- Public packages such as `@chat-js/cli` publish to npm.
- Desktop installers for `@chat-js/electron` publish to GitHub Releases.

## License

Apache-2.0

<br />
<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>
<br />

### Local Eve runtime

With `EVE_ENABLED=true` in `.env.worktree.local`, `bun dev` starts ChatJS and
Eve together using `withEve`. Keep the isolated development database configured;
this does not enable the production migration. There is no separate Eve process
to start for normal development.

For unattended local development on macOS:

```sh
bun dev:service start   # launchd supervision for this checkout; also starts at login
bun dev:health         # bounded ChatJS + Eve + database readiness check
bun dev:service status # process state and log location
bun dev:service stop   # stop this checkout and remove its login startup entry
```

Stop a manually running `bun dev` before starting the service. Each checkout has
its own service identity and worktree port. The supervisor checks readiness every
ten seconds. Startup gets three minutes initially, then six and at most ten
minutes after consecutive unsuccessful launches, so slow compilation can finish.
Eve's development startup timeout is also ten minutes. Once healthy, the runtime
must remain unavailable for two minutes across at least three failed checks
before it is replaced. A successful readiness check resets the startup allowance;
process exits still trigger recovery immediately. Restarts back off to sixty
seconds. Node heaps are capped at 4 GiB
per process; this is not a total system memory cap. Logs are retained under
`~/Library/Logs/ChatJS/` (the status command prints the checkout's directory).
The Mac must be awake and the database/network available; supervision cannot
make a sleeping laptop serve traffic. `bun dev:service stop` leaves other
checkouts alone.
