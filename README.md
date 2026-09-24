<div align="center">

<img src="apps/chat/app/icon.svg" alt="ChatJS" width="64" height="64">

# ChatJS

Stop rebuilding the same AI chat infrastructure. ChatJS gives you an EVE-native foundation with authentication, models, streaming, and tools so you can focus on what makes your app unique.

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
- **Native EVE Runtime**: Durable conversations, approvals, and recovery
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
- [EVE](https://github.com/openai/eve) - Durable conversation runtime
- [Vercel Blob](https://vercel.com/storage/blob) - Blob storage
- [Shadcn/UI](https://ui.shadcn.com) - Beautiful, accessible components
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [tRPC](https://trpc.io) - End-to-end type-safe APIs
- [Zod](https://zod.dev) - Schema validation
- [Motion](https://motion.dev) - Animations
- [t3-env](https://env.t3.gg) - Environment variables
- [Pino](https://getpino.io) - Structured Logging
- [Langfuse](https://langfuse.com) - LLM observability & analytics
- [Vercel Analytics](https://vercel.com/analytics) - Web analytics
- [Oxlint and Oxfmt](https://oxc.rs) - Code linting and formatting
- [Ultracite](https://ultracite.ai) - Oxlint and Oxfmt presets for humans and AI
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
- `bun lint`: check repository-wide Oxlint rules and Oxfmt formatting, plus docs health
- `bun format`: format the repository with Oxfmt
- `bun lint:fix`: apply safe Oxlint fixes
- `bun test:types`: type-check the workspaces

Ultracite supplies the Oxlint and Oxfmt presets. All files receive the full presets. Necessary exceptions are documented at the affected source lines rather than disabled through file-wide baselines. Oxfmt skips build output and the five generated registration indexes whose exact content hashes are verified by `chat-js sync`.

Set `CHATJS_DEV_SLOT` in `.env.worktree.local` to reserve a stable range of ten ports per worktree. Within each range, chat uses offset `0`, Electron uses `1`, and the site uses `2`, as configured in `.worktree-env.json`. The local file is ignored by Git and kept separate from Vercel-managed `.env.local`. Run `bun dev:info` instead of assuming a port.

### Native Eve runtime

EVE is the sole ChatJS conversation runtime. It owns the durable transcript, execution state, approvals, checkpoints, and stream recovery. ChatJS owns authenticated access, conversation metadata, projects, sharing, files, documents, and billing evidence around that runtime. Historical ChatJS conversations are not imported.

Local EVE development requires Node 24+, Bun, ChatJS and Workflow World Postgres configuration, and the EVE gateway secret specified by the app environment schema. Use isolated local databases while developing or validating lifecycle changes.

The EVE-only runtime does not itself establish production readiness. Provider deletion coverage and guest-hosting readiness remain release gates. See [the migration report](docs/eve-migration-report.md) for the current boundary and historical validation evidence.

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

### Local EVE runtime

`bun dev` starts the local application with its EVE runtime. Keep its configured databases isolated from shared environments.

For unattended local development on macOS:

```sh
bun dev:service start   # launchd supervision for this checkout; also starts at login
bun dev:health         # bounded ChatJS + Eve + database readiness check
bun dev:service status # process state and log location
bun dev:service stop   # stop this checkout and remove its login startup entry
```

Stop a manually running `bun dev` before starting the service. Each checkout has its own service identity and worktree port. The supervisor checks readiness every ten seconds. Startup gets three minutes initially, then six and at most ten minutes after consecutive unsuccessful launches, so slow compilation can finish. Eve's development startup timeout is also ten minutes. Once healthy, the runtime must remain unavailable for two minutes across at least three failed checks before it is replaced. A successful readiness check resets the startup allowance; process exits still trigger recovery immediately. Restarts back off to sixty seconds. Node heaps are capped at 4 GiB per process; this is not a total system memory cap. Logs are retained under `~/Library/Logs/ChatJS/` (the status command prints the checkout's directory). The Mac must be awake and the database/network available; supervision cannot make a sleeping laptop serve traffic. `bun dev:service stop` leaves other checkouts alone.
