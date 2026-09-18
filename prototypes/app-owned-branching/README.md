# App-owned branching prototype

Throwaway persistence experiment. No production imports, routes, migrations, UI changes or EVE/private-API calls. See the [feasibility report](../../docs/upstream-drafts/eve-app-owned-branching-prototype.md) for conclusions, exact upstream refs and integration gaps.

From the repository root:

```sh
bun install --frozen-lockfile
bunx vitest run --config prototypes/app-owned-branching/vitest.config.ts
bunx tsc -p prototypes/app-owned-branching/tsconfig.json
```

Requires local `initdb` and `pg_ctl` on PATH. The tests create a new PostgreSQL cluster with TCP disabled and a private temporary Unix socket. They never load environment files or connect to a supplied database. Database, mock files and resource bytes are disposed at teardown. An externally killed test process may leave its clearly named `chatjs-branch-PROTOTYPE-*` cluster to clean up manually.

- `model.ts`: immutable message prefixes, annotations, resource references, writer admission, checkpoint and child-operation journals.
- `schema.sql`: scratch schema only, intentionally outside the application's Drizzle schema.
- `mock-provider.ts`: stopping capture and independent restore, with durable replay receipts stronger than the actual Vercel snapshot API.
- `branching.test.ts`: 20 ownership, concurrency, historical selection, isolation and interrupted-operation scenarios.

This models app-authoritative history. It is not a second transcript wired to EVE. Production should first try native-authoritative immutable prefix references and a narrow native continuation contract. Resource GC, native initialization, real providers, complete process fencing, cross-owner public copies, and Workflow deployment are outside the demonstrated scope.
