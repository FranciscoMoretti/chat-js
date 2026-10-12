# Async fixture values follow-up

Scope: remaining `typescript/promise-function-async` comments in `apps/chat/lib/**/*.test.ts`, excluding `health.test.ts` and registry-owned files.

## Changes

Removed nine lint directives by using settled mock APIs for fixed test values:

- `ai/mcp/mcp-oauth-provider.test.ts`: authorization redirect now uses `vi.fn<() => Promise<void>>().mockResolvedValue()`.
- `eve/followup-sdk-usage.test.ts`: the model's fixed generation result now uses `vi.fn().mockResolvedValue(...)`.
- `eve/model-selection.test.ts` and `eve/research-availability.test.ts`: fixed provider errors now use `mockRejectedValue(...)`.
- `eve/tool-cost.test.ts`: fixed model list now uses `mockResolvedValue(...)`.
- `eve/verify-local-coverage.test.ts`: both fixed fetch responses now use `mockResolvedValue(...)`.
- `eve/create-conversation-operation.test.ts`: `canSpend` is now a hoisted mock whose resolved `true` default is re-established after `resetAllMocks`.
- `eve/research-tool.test.ts`: fixed completion time uses a hoisted mock whose resolved value is re-established after `resetAllMocks`.
- `eve/followup-sdk-usage.test.ts`: model resolution uses a hoisted mock configured after the model fixture initializes.

Kept or refined the other exceptions where a mock value API would change behavior: checkpoint polling needs a fresh `Response` body per call; file-key preparation computes from each call's keys; mutable OAuth state must be read at call time; route and research-agent fixtures derive results from arguments or call count; cancellation fixtures return the original pending promise; callback tests preserve synchronous side effects; and native Blob methods preserve their settlement ordering.

Only test fixtures changed; no production files or lint rules changed.

## Validation

- `PATH=/Users/fran/.volta/tools/image/node/24.20.0/bin:$PATH bunx oxlint --type-aware apps/chat/lib --format json`: passed, zero diagnostics across 364 files.
- Focused Vitest run for ten affected fixtures: passed, 10 files and 91 tests.
- `git diff --check -- apps/chat/lib`: passed.
- Intermediate focused runs exposed the fresh-`Response` polling constraint and Vitest `resetAllMocks`/hoisted factory behavior; the fixtures were adjusted to preserve those contracts before the final passing run.
