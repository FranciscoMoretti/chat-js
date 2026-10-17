# Native eve 0.80.1 through the ChatJS stream proxy

This proof executes the actual ChatJS GET handler, query policy and response relay against a real published eve 0.80.1 HTTP server. The principal, conversation lookup and upstream URL mapping are fixtures. It does not prove a deployed Next app, real database authorization or the complete candidate package from fork PR #9. That candidate has a separate integration checkpoint.

Production change: permit the exact `follow=false` query emitted by the native client for bounded history. Other follow values, duplicate keys, negative or oversized cursors and unknown parameters stay rejected. POST query strings stay rejected. The production eve package pin remains unchanged.

## Reproduce

From the repository root, install the locked workspace dependencies with Bun. Then run:

```sh
bun install --cwd experiments/eve080-stream-proxy --frozen-lockfile --ignore-scripts
/opt/homebrew/opt/node@24/bin/node experiments/eve080-stream-proxy/proof.mjs
bun run --cwd apps/chat test:unit 'app/api/eve/[...path]/route.test.ts'
```

Use any Node 24 executable on other hosts. The script creates a disposable local world, uses a deterministic model, discovers the HTTP port, starts Vitest with the fixture address, and stops its server. No live environment files or database are loaded by the authored backend. The scenario has an explicit config so its real 60-second lease test is not added to the ordinary unit suite.

## Evidence

`RESULTS.json` records the successful run. Six HTTP scenarios passed: bounded full history and exact cursor replay, native idle heartbeats and lease EOF, browser abort followed by reconnect, two cross-origin rejections and foreign ownership rejection before upstream dispatch. The bounded scenario checks every allowed stream header and exact event equality, including empty reads at the tail. The idle scenario receives only the native `$eve: stream.lease-ended` control, then reconnects from the same event count. Its transport accepts GET only, so an implicit command resend fails the proof. Raw protocol controls are inspected; native client's automatic reconnect/parser is source-mapped in the fork slice, not independently claimed as executed here.

The first run caught a mistaken assertion expecting `type: stream-control`; upstream uses `$eve: stream.lease-ended`. Correcting the expectation produced the recorded green run. No production behavior was altered to make the lease pass.

The ordinary route tests cover the allowlist and rejected variants. Full workspace lint and eight type tasks pass with the current maintained eve pin. These are not claims that both ChatJS agents compile against native eve 0.80.1.

Adoption remains gated on the upstream package integration, approval consumers, copy/attachment/sandbox contracts and distribution. The PostgreSQL consumed-prefix optimization is not replaced by this HTTP proof. No old-session compatibility, credential authority fallback, billing import or automatic resend is introduced.
