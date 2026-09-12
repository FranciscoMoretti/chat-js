# Existing-app document write repair

Base: `8178650771aed69e75421a988e6c57f69ac131ca` (origin/main refreshed 2026-09-07; includes merged #317). Branch `codex/document-write-repair`. The original local repair396e151f was rebased without conflicts; neither feature worktree changed. This is a separate review slice for #323. No schema migration, runtime/provider replacement or data cleanup.

Changes:

- tRPC and text/code/sheet edits share `updateDocument`, which locks existing revisions in a transaction, rejects missing or inconsistent ownership/kind, and appends using the existing owner. Public readability never authorizes a write.
- Missing tool caller returns an error before persistence. Creation requires an owner. Success dates come from the inserted row returned by PostgreSQL, not a second clock read.
- tRPC artifact kind uses the existing runtime enum.
- Existing read/share/delete behavior and schema remain unchanged. No stale-base/CAS guarantee is added. Locking existing revision rows is not a stable parent-owner lock and does not solve historical branching or externally injected inconsistent ownership. Inconsistent existing histories fail closed, with no automatic repair.

## Verification

Refreshed 2026-09-07: all checks below and the actual PostgreSQL proof were rerun after the conflict-free rebase onto current main.

- Root `bun lint`: passed (app executed; three unrelated tasks cached).
- Root `bun test:types`: passed (app executed; two unrelated tasks cached).
- `bun run --filter @chatjs/chat test:unit`: **35 files / 181 tests passed**, including **32 new regressions** for query authorization, actual tool entrypoints and tRPC input/auth behavior.
- `git diff --check`: passed.
- Actual PostgreSQL17 proof imports the changed queries and real Drizzle/Postgres implementation: persisted timestamp matches stored timestamp, valid edit preserves original message link, foreign/kind/mixed-owner edits are denied without adding rows, save failure rejects and leaves row count unchanged. A disposable unix-socket-only PostgreSQL cluster was used and stopped afterward.

Initial root types failed because the existing shared Thread task cache restored success without `dist` declarations. Ran the existing `bun run --filter @chat-js/thread build` to materialize the dependency output, then reran root checks successfully. No production app build and no cache/config fix included.

The PostgreSQL proof deliberately creates only the Document table shape, without app User/Message foreign keys or production authentication. It validates real query behavior rather than full application database provisioning. Other imported services are mocked to throw if used. Run this standalone in its own Bun process; do not import it into a shared test process, because its Bun module substitutions are process-wide. Normal committed regression tests use Vitest isolation and the complete app unit suite passed.

Reproduce unit checks after `bun install --frozen-lockfile --ignore-scripts`:

```sh
bun run --filter @chat-js/thread build
bun lint
bun test:types
bun run --filter @chatjs/chat test:unit
```

Reproduce the PostgreSQL proof with a new disposable cluster (requires local PostgreSQL binaries; example Homebrew17):

```sh
task_pg_dir=$(mktemp -d /tmp/chatjs-document-pg.XXXXXX)
/opt/homebrew/opt/postgresql@17/bin/initdb -D "$task_pg_dir/data" -A trust --no-locale
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D "$task_pg_dir/data" -l "$task_pg_dir/server.log" -o "-k $task_pg_dir -c listen_addresses=''" -w start
DOCUMENT_PROOF_SOCKET="$task_pg_dir" bun research/document-write-repair/postgres-proof.ts
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D "$task_pg_dir/data" -m fast -w stop
```

The proof intentionally injects a database exception; the existing query logger prints it before the final success message. Earlier harness attempts were corrected for raw timestamp-without-timezone parsing (interpret as UTC, matching Drizzle) and Drizzle wrapping PostgreSQL errors in `cause`; final invocation passed. No real credentials or user content are used.

## Remaining limits

Browser was not rerun. Source inspection confirms `components/part/document-tool.tsx:60` passes the returned date and `components/artifact-panel.tsx:406` displays it. The artifact panel still selects the latest revision for `messageId`, falling back to latest overall (`:96–121`), rather than selecting by exact date. This repair therefore fixes emitted persisted identity, not the broader exact historical-revision UI contract.

File ownership/catalog authorization, stale draft recovery, exact-base conflict semantics, operation retry deduplication, stable document parent schema, retention/sharing decisions and historical execution remain separate work. Existing timestamp-key collision behavior is unchanged.
