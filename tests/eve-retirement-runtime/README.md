# Released-runtime retirement harness

This isolated package uses published **EVE 0.71.3**, its bundled **Workflow 5.0.1** runtime (serde 5.0.0), **AI SDK 7.0.106** and deterministic `eve/evals` mock models. It does not resolve ChatJS's production fork alias. Its Bun lockfile is separate from the monorepo's.

From the repository root:

```sh
bun install --cwd tests/eve-retirement-runtime --frozen-lockfile
# Node 24+ must be on PATH, or set EVE_TEST_NODE to its absolute executable.
bun run --cwd tests/eve-retirement-runtime test
bun run --cwd tests/eve-retirement-runtime tsc --noEmit
```

On the current macOS host:

```sh
EVE_TEST_NODE=/opt/homebrew/opt/node@24/bin/node bun run --cwd tests/eve-retirement-runtime test
```

The launcher copies a fixture into a fresh OS temporary directory, links only this package's dependencies, starts the real EVE evaluation CLI and local Workflow world, and runs HTTP create/send/tool/replay assertions. The CLI chooses a loopback port. The child receives an allowlist of environment variables; no provider, database or app credentials are inherited. Docker discovery points to a nonexistent disposable socket. Successful runs remove their fixture/storage; failed runs retain it and print its location. Nothing reads or writes the parent checkout.

Feature lanes can supply an absolute fixture directory:

```sh
EVE_TEST_NODE=/absolute/path/to/node bun tests/eve-retirement-runtime/run.ts /absolute/path/to/feature-fixture
```

A fixture contains `agent/agent.ts`, instructions, authored channels/tools, `evals/evals.config.ts`, and `*.eval.ts`. Use only mock models and disposable effects. The launcher supplies `node_modules` and the project manifest; do not include either, `.env` files, live credentials or preexisting runtime storage in a fixture. Put any additional required exact dependency in the shared package through Lane D. The baseline smoke fixture is the minimal runnable example.

Passing this smoke test proves that the released runtime executes tools and persists/replays separate received messages. It does **not** prove exact caller correlation after a lost response, restart semantics, approval authority, coalescing, backend compatibility, or existing-run migration. Feature lanes must add their own adversarial assertions. No automatic resend is implemented.
