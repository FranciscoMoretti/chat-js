# M09 Postgres and host-identity proof

Run from this directory with Bun 1.3.11 and PostgreSQL 17 binaries:

```sh
bun install --frozen-lockfile
bun run test:types
bun run lint
bun run test
```

`PG_BIN` defaults to `/opt/homebrew/opt/postgresql@17/bin`; override for your installation. No pre-existing database, model credentials, Next server, OAuth provider, or login system is used. `bun run test` is an integration harness, not `bun test` file discovery.

The harness creates a private temporary cluster under `/tmp/m09-pg-*`. PostgreSQL has TCP disabled and a unique Unix socket directory; its port is discovered with an ephemeral socket. API child processes bind loopback port zero and report their OS-assigned ports through private readiness files. The harness terminates only its own child processes/cluster and removes its temporary directory in `finally`. It uses immediate PostgreSQL shutdown and API SIGKILL deliberately to prove crash recovery. Run only against this harness-created infrastructure.

`schema.ts` preserves M07 `688c7e94` / PR318 `1b47cffe` ownership columns and checks, adding a separate revocation marker and optional saved metadata. `api.ts` is a focused proposed tRPC API over real Postgres, not production M07 code copied verbatim. It has explicit output schemas and an inferred `AppRouter`. `identity.ts` is an existing host's JWT verification seam: the test host issues expiring tokens and the server verifies signature, issuer and audience before deriving a tenant-qualified owner. No auth/account tables or login dependency are installed. The identity key is generated per run, passed only to child environment, and never logged or committed.

The external execution callback is controlled. It appends a private test ledger before returning a session ID, waiting for a test release, throwing an ambiguous response, or killing the API. This proves reservation behavior around an external operation. It does **not** exercise Eve, workflow storage, public-Eve create idempotency, model/tool behavior or actual stream replay. `sessionBinding` is a fixture-only session ACL lookup, not an Eve-compatible streaming gateway.

Seven scenarios cover owner metadata CRUD; foreign operations; invalid credentials; issuer/tenant separation; concurrent creates across two API processes; concurrent metadata CAS; full API and Postgres crash/restart; create crash after a controlled external effect; and metadata removal versus access revocation. `evidence.json` contains sanitized source pins, versions, check counts and selected ports from the last successful run. The output lists only scenario results, not credentials/messages.

`history.forget` removes only metadata and leaves execution access intact. `conversation.revoke` tests a possible tombstone behavior: it denies subsequent reads/writes but retains the binding. These are two **separate options**, not an enacted Delete policy. Neither cancels a running execution, revokes an already-open stream, deletes files or purges Eve. Those product decisions remain in [the plan](../plan.md).

The list fixture deliberately implements only a bounded first page. Keyset pagination, pin updates, metadata auto-save repair, optional transcript snapshots, browser query ownership, real login flows, actual generated source/dependency omission and public-Eve reopening remain implementation-stage acceptance. This fixture proves no-history *schema/API omission* and no second identity system; its `history` boolean is not itself proof of registry source/dependency omission.
