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
- `apps/docs`: Mintlify docs ([chatjs.dev/docs](https://chatjs.dev/docs))
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
