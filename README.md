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

The optional `/agent` route uses `useEveAgent` and a private Eve worker. Eve owns
the durable transcript, approvals and execution. ChatJS authenticates requests
and stores only conversation ownership, creation intent and the Eve session ID.
The worker uses the selected ChatJS gateway/model. Existing chat routes continue
to use the current runtime until feature parity is ready.

Use Node 24+ for Eve and Bun for package scripts. Set `EVE_ENABLED=true`, a random
`EVE_GATEWAY_SECRET` of at least 32 characters, and `WORKFLOW_POSTGRES_URL` in
`.env.worktree.local`. Use a separate local database for the Workflow World;
`DATABASE_URL` continues to hold ChatJS data. Apply ChatJS migrations with
`bunx dotenv -e .env.worktree.local -e .env.local -- bun db:migrate`, then initialize the World with:

```sh
bunx dotenv -e .env.worktree.local -- node node_modules/@workflow/world-postgres/bin/setup.js
bun build:eve
bun dev:eve
```

Run `bun dev` in another terminal. Worktree tooling assigns the worker offset `4`
and supplies the app's internal worker URL. Rebuild and restart the worker after
editing `apps/chat/agent`. The worker listens on loopback and requires the shared
secret; browsers use only authenticated same-origin ChatJS routes.

This development milestone supports linear text conversations, persistent
human input, reconnect, cancellation, and a confirmation tool without external
effects. It is disabled in production even when the flag is set. Production
admission/billing, the full tool set, branch/import support, and automatic
reconciliation remain later stages. An uncertain creation is retained and
blocked from redispatch; a connection error is not proof that a send failed.
Reconnect before deciding to resend.

The deterministic acceptance fixture uses the real channel, tool and durable
worker with Eve's mock model. With isolated local databases and the app running,
stop the normal worker, build/start the fixture from
`apps/chat/tests/eve-fixture` using `eve build` and `NODE_ENV=production eve start
--host 127.0.0.1 --port <assigned Eve port>`. Supply the same environment as the
normal worker. Then run from `apps/chat`:

```sh
PORT=<assigned chat port> bunx playwright test --config playwright.eve.config.ts
bunx vitest run --config vitest.eve.config.ts
```

The database contract suite requires a local `DATABASE_URL`; the browser suite
uses development login. Sanitized screenshots go to `tests/eve-results`.
Restart the normal worker after fixture testing. External model credentials
are still needed to verify a real provider response.

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
