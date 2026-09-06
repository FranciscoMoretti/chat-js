# #319: combined UI and selected-app acceptance

Bounded coexistence validation passed. This is **not** acceptance of a combined
P1/Eve UI runtime: that interface is absent from both input PRs. Production
acceptance still requires review of #317/#318 and the independent #315 gates.

## Pins and ownership

- Base/main: `18db694b9b67263904707a85f93673f494ea0e6d` (SDK 7).
- PR #317 UI: `c686b31bb0fe00e3234eaa92af7f81ed4d172ad7`.
- PR #318 CLI/Eve: `1b47cffe692acb8e2ebaf1ebebfa7ec76df75f10`.
- Local integration merge: `b63b7593e38d13480f96da766961c553e9476b2e`.
- Independent cache fix: `9f0926f7680cdc2ee8bac0d5010ca87b7fcd4dd1`.
- Branch: `codex/319-ui-selected-integration`; worktree `db6e` only.

Both input histories are preserved. #317 fast-forwarded the base; #318 merged
with `ort`, no conflicts, no hand edits. The two input changed-file lists have
no intersection. `evidence/integration-diff-stat.txt` records the combined
change. Use `git diff BASE INTEGRATION` for the exact diff. No PR was merged,
no package/registry published, no deployment or upstream submission made.

## Acceptance matrix

| Contract | Result and evidence | Limit |
| --- | --- | --- |
| Combined root lint/types | Pass, including forced uncached run and cache restoration proof | Root excludes the standalone Eve example; it was checked separately |
| Reference units / Thread / CLI | 155 reference tests, 65 Thread tests, 42 CLI tests pass; worktree-port tests also pass | Controlled transports are not provider completion |
| Mounted independent P1 views | Pass: two production `ConversationView`s and view hooks, actual Thread and React subscriptions, independent sends/cursors and targeted stop | React test renderer with only the runtime binding substituted; not two production message/composer panels in a browser |
| Query and view lifetime | Pass: one shared QueryClient fetch, retained cache/selection over one view's unmount/remount, execution continues after disconnect | Probe query; not a full tRPC invalidation or eviction suite |
| Origin-targeted actions | Pass: detached source view cannot retarget panel edit; edit retains parent and panel stop leaves sibling run intact | Controlled transport, not exact persisted document revision semantics |
| Selected generation | Pass: actual built CLI create/add, source/dependency omissions, compiled Eve tool sets, external tool/banner/layout/provider, edited-source proposals and negative type contracts | Explicit-target universal registry contract only |
| Default full scaffold | Pass: built CLI create, install and typecheck; P1 files copied, Thread vendored, Eve absent | Generated full scaffold not browser-run; reference app was |
| Generated app live | Pass: actual CLI output, real OpenAI model, Next 16.3 and Eve 0.52.1 on own Postgres | Linear app only |
| Auth and durable binding | Pass: 28 auth/CSRF checks; two DB tests / 11 assertions | Does not resolve upstream ambiguous create-once recovery |
| Approval/replay/restart | Pass: pending approval recovered after terminating and restarting both Next and Eve, exact prior event IDs, typed result and continuation | Public linear replay, no branch history seeding |
| Stop/send | Pass: accepted durable cancellation, `turn.cancelled`, successful subsequent send via `sendTurn` | Cooperative boundary, no immediate provider abort/rollback |
| Browser selected app | Pass: first send, enabled Approve click, lazy note result; follow-up invokes external weather and renders London 20°C; layout/banner present | API harness, rather than browser clicks, asserted cancellation |
| Next diagnostics | No compilation issues and no reported session errors for generated app and reference page | Next error endpoint does not establish provider success |
| Reference app runtime | Authenticated page and composer load; attempted real send exercised error handling | Send blocked by `GatewayAuthenticationError`, same limitation as #317 |
| P1 components in generated Eve app | **Not implemented** | No installable ConversationView/Workspace, common runtime adapter, origin API or multi-view selected preset |
| Generated independent views/pending input ownership | **Not supported** | Starter is single-conversation UI; do not infer multi-mount support from JSX extensibility |

## Findings and handoffs

1. **P2, fixed: cached Thread typechecks omit emitted declarations.** On this
   fresh checkout, cached `@chat-js/thread:test:types` did not restore `dist`,
   causing app diagnostics. After an uncached pass, removing `dist` yielded
   **all four tasks successful from cache while declarations remained absent**.
   Thread's type task invokes its build but declared no outputs. The isolated
   fix adds `packages/thread/turbo.json` with `test:types.outputs = ["dist/**"]`.
   The same removal/replay now restores `dist/index.d.ts`. This is a preexisting
   workspace/cache defect exposed by integration, not attributable to either
   PR's feature code. Repo/Thread owner can cherry-pick `9f0926f7` independently.
2. **Acceptance gate: no combined view/Eve contract.** #317 remains tied to the
   reference ApplicationThread; #318 has its own linear Eve projection. No
   adapter, plugin framework or branching implementation was invented. UI and
   CLI owners should agree on a later explicit installable view boundary before
   claiming generated P1 parity. The selected starter's module-level client,
   URL binding and `chatjs.pending-create` sessionStorage key are single-app
   assumptions, not independently scoped view contracts.
3. **Reference live provider gate remains open.** Local auth and DB migration
   succeeded, but Vercel AI Gateway rejected model listing and send. A valid
   gateway credential is needed to complete the unchanged reference provider
   path. OpenAI direct credentials worked for the generated Eve app. Do not
   infer a regression from the difference between these two provider paths.
4. **Low priority existing warning:** reference layout emits `Invalid layout
   total size: 65%` when only its main panel is mounted; library normalizes it.
   `chat-layout.tsx` is unchanged by both PRs. No behavior failure observed;
   left outside the integration fix.

## Reproduction and evidence

Runtime: Bun 1.3.11; Node 24.20.0 from `/opt/homebrew/opt/node@24/bin`; macOS ARM64;
Postgres 17. Worktree slot 319 discovered with `bun dev:info --json`: reference
6190, selected Next 6194, Eve 6195. Own loopback Postgres 56319, separate `m07`
and `reference319` databases. Never used another task's live DB or ports.

Run from repo root with Node 24 first on PATH:

```sh
bun install --frozen-lockfile
bun lint --force
bun test:types --force
bun test:unit
bun run --cwd packages/cli build
M08_KEEP_GENERATED=1 bun packages/cli/tests/selected-app.ts
bash research/319/run-mounted.sh
bash research/319/cache-proof.sh
bun run --cwd examples/minimal-next lint
bun run --cwd examples/minimal-next test:types
```

Build and CLI unit commands both materialize the same template directory: run
those **sequentially**. One initial concurrent invocation collided in `cp`; the
serialized unit rerun passed. Initial install under default Node 22 failed in
`fs-xattr`/node-gyp; Node 24 installation succeeded without a source change.

The selected CLI integration writes its isolated output path in
`evidence/selected-app.log`. For the live extension, copy the existing example's
`proof.ts`, `identity.ts`, `browser-identity.ts` and Postgres helpers into that
output's `scripts/` (the CLI intentionally omits proof helpers). Configure fresh
secrets, provider credential, both database URLs and origins in its ignored
`.env.local`. Use example README setup commands with `M07_PG_PORT=56319`, then
start each app through the root dotenv/worktree-env wrapper:

```sh
# app319 is the actual generated output directory, not another checkout.
bun node_modules/dotenv-cli/cli.js -e .env.worktree.local -e "$app319/.env.local" -- bun run worktree-env minimal -- bun run --cwd "$app319" dev
bun node_modules/dotenv-cli/cli.js -e .env.worktree.local -e "$app319/.env.local" -- bun run worktree-env minimalEve -- bun run --cwd "$app319" eve:start
bun node_modules/dotenv-cli/cli.js -e "$app319/.env.local" -- bun "$app319/scripts/proof.ts" prepare
# Stop and restart both own listeners before resume; keep own Postgres running.
bun node_modules/dotenv-cli/cli.js -e "$app319/.env.local" -- bun "$app319/scripts/proof.ts" resume
bun node_modules/dotenv-cli/cli.js -e "$app319/.env.local" -- bun "$app319/scripts/proof.ts" cancel
```

Sanitized `evidence/generated-{prepare,resume,cancel}.log` contains assertions;
`browser-{own-pending,approved,weather}.txt` contains actual rendered states.
`evidence/mounted.log` records the bounded mounted test. Cache red/green logs
are named `types-{initial-cache,cache-repro,cache-restored}.log`. Browser cookies,
credentials, DB data and generated dependency directories are not artifacts.

No production build was used to typecheck. Eve compilation was needed to run
its actual workflow service. Services are stopped at handoff; disposable data
is local only. Production acceptance remains conditional as listed above.
