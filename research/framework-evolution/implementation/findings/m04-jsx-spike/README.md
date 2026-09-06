# Direct JSX functional composition proof

No component factory or registry. Directly imported components read scoped Zustand and TanStack Query hooks. ExternalComposer is a separately authored local source stand-in, not a new external registry installation. Browser requests use an in-memory recording API, not Eve or production routes.

From repo root, with the current frozen dependencies installed:

```sh
# Skip if ignored link already exists.
ln -s ../../../../../apps/chat/node_modules research/framework-evolution/implementation/findings/m04-jsx-spike/node_modules
bun apps/chat/node_modules/typescript/bin/tsc -p research/framework-evolution/implementation/findings/m04-jsx-spike/tsconfig.json
bun research/framework-evolution/implementation/findings/m04-jsx-spike/proof.ts
```

Requires installed Chrome. The proof starts an ephemeral loopback Bun server, builds the fixture in memory, runs Playwright, and closes both browser and server. No application server, credentials or persistent DB needed. No dependency or lockfile modifications.

Observed: 2 mounted views, 3 correctly targeted submissions, 4 shared query reads (initial plus each invalidation), zero page errors. Standalone typecheck rejects unavailable model IDs without a generic factory. Source builds against repo lockfile React 19.2.3, Zustand 5.0.12, Query 5.97.0, TypeScript 6.0.2; Bun 1.3.11.

Intentional limits: messages are linear query data; no Eve runtime or branching. Fixed view binding requires remount on change. Draft equality guard illustrates preserving different later text, not generation-complete async protection. No authentication, streaming, uploads, install resolution or lazy renderer proof. Plain forms are fixtures to exercise hooks, not replacement UI primitives proposed for the product.

Validation after formatting: standalone typecheck and browser proof passed again; direct Biome check formatted/checked 11 fixture files. Root `bun lint` (4 tasks) and `bun test:types` (3 tasks) passed through Turbo cache; research source is outside those tasks, hence the separate checks above.
