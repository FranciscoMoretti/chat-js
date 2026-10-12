# Library strict-boolean-expressions audit

Scope: apps/chat/lib/** excluding generated registry-owned eve/mcp-tools.ts. Baseline docs/lint-cleanup-baseline.json has 40 memberships in 29 files; the pre-pass working tree also had 40 directives in those 29 files, covering 76 actual diagnostics. Removed all 40 directives and matching enables. Current owned suppressions: 0. Retained: 0. Unresolved: 0.

## Behavior And Implementation

- A direct isNonEmptyString type guard recognizes strings of positive length without trimming. It preserves a single guard-value read and narrowing of the original optional receiver, so later original getter reads still occur. Empty strings/null/undefined remain absent; whitespace and "0" remain present. No Boolean wraps added.
- Optional Zod success/retry flags use === true. Database first-row destructuring checks explicitly compare undefined: absent rows really are undefined despite inferred nonnullable iterator element types. No guards removed as supposedly redundant.
- Array lengths use explicit presence and positive length. Lengths are real array/string lengths, nonnegative integers rather than unconstrained numbers, so NaN and negative values are not part of their domain. No arbitrary numeric value was changed to a >0 test.
- Migration URL fallback still returns the selected URL string, not a truthiness boolean. The migration getter is read once only for migration purpose; DATABASE_URL remains lazy fallback for absent/empty values. Runtime purpose does not touch the migration getter.
- Logical-chat pending path selection preserves undefined/empty-string/path results through an explicit ternary using a private-field snapshot. It does not substitute false for an absent value. The class private field has no accessor/external mutation during this synchronous operation.
- Request body content-type recognizes nonempty text and all non-nullish binary/stream/object bodies. The body guard is read once before the original init spread. Empty text and missing bodies still omit content-type.
- Response group fork predicates are typed to the already-validated Zod fork shape instead of unknown. Schema validation still rejects invalid fork payloads before refinement; refinements return explicit boolean conditions.
- Test mocked startsWith/endsWith calls compare their native boolean results to true instead of treating untyped results as arbitrary truthy values.

## Verification

- bunx oxlint --type-aware --format json apps/chat/lib: exit 0, 367 files, no diagnostics. /tmp/lib-boolean-final-lint.json.
- bunx vitest run --config apps/chat/vitest.config.ts apps/chat/lib apps/chat/tools/chatjs/_shared/lib/define-tool-renderer.test.ts: exit 0, 131 files, 794 tests. /tmp/lib-boolean-final-tests.log.
- bunx tsc --noEmit --incremental false -p apps/chat/tsconfig.json: exit 0, no diagnostics after root fixed concurrently-owned source errors. /tmp/lib-boolean-final-types.log. No typegen or integrated mutation commands run.
- Browser renderer visual fixture (packages/registry cwd, visual/vitest.config.ts): 1 file, 2 tests pass, validated-chart-output and weather/retrieved URL state captures archived. /tmp/lib-boolean-renderer-browser.log. Boolean changes only affect schema-success conditions, not layout/styles. Live UI Verify comparison remains unavailable without API credentials as established in prior UI pass.
- New predicate test table covers empty text, null, undefined, 0, NaN, false, object, whitespace, "0", and normal IDs (10 cases).
- Existing library suite covers gateway policy/auth, missing mapping/creation/file rows, lineage/forks, model pricing, pending delivery/retry, URL selection and logical-chat branch projection.
- git diff --check -- apps/chat/lib: clean. No configs, dependencies, public API shapes, or other owners' source files changed.

## Per-file Counts

Counts are baseline directive memberships and the pre-pass actual conditional diagnostics, not raw textual rule references. All current, retained and unresolved columns are zero.

| File (apps/chat/lib/) | Baseline memberships | Pre-pass sites | Current memberships | Retained | Unresolved |
| --- | --: | --: | --: | --: | --: |
| ai/define-tool-renderer.tsx | 1 | 2 | 0 | 0 | 0 |
| auth.ts | 1 | 1 | 0 | 0 | 0 |
| credits/cost-accumulator.ts | 1 | 2 | 0 | 0 | 0 |
| db/connection.ts | 1 | 1 | 0 | 0 | 0 |
| db/eve-search.ts | 1 | 1 | 0 | 0 | 0 |
| db/file-storage-keys.ts | 1 | 1 | 0 | 0 | 0 |
| eve/conversation-scope.ts | 1 | 7 | 0 | 0 | 0 |
| eve/copy-transcript.ts | 1 | 1 | 0 | 0 | 0 |
| eve/create-conversation-operation.test.ts | 1 | 1 | 0 | 0 | 0 |
| eve/create-conversation-operation.ts | 1 | 2 | 0 | 0 | 0 |
| eve/create-response-group.test.ts | 1 | 1 | 0 | 0 | 0 |
| eve/delete-local-conversation.ts | 1 | 1 | 0 | 0 | 0 |
| eve/execute-conversation-creation.ts | 3 | 3 | 0 | 0 | 0 |
| eve/fork-source.ts | 2 | 3 | 0 | 0 | 0 |
| eve/gateway-auth.ts | 4 | 10 | 0 | 0 | 0 |
| eve/logical-chat.ts | 3 | 14 | 0 | 0 | 0 |
| eve/logical-response-slots.ts | 1 | 3 | 0 | 0 | 0 |
| eve/message-delivery.ts | 2 | 4 | 0 | 0 | 0 |
| eve/pending-create.ts | 2 | 2 | 0 | 0 | 0 |
| eve/purge-local-sandbox.ts | 1 | 1 | 0 | 0 | 0 |
| eve/reconcile-usage.ts | 1 | 1 | 0 | 0 | 0 |
| eve/resolve-creation-request.ts | 1 | 1 | 0 | 0 | 0 |
| eve/response-group-input.ts | 1 | 2 | 0 | 0 | 0 |
| eve/response-group-lineage.ts | 1 | 5 | 0 | 0 | 0 |
| eve/response-group.ts | 1 | 1 | 0 | 0 | 0 |
| eve/retire-session.ts | 2 | 2 | 0 | 0 | 0 |
| eve/server.ts | 1 | 1 | 0 | 0 | 0 |
| eve/tool-selection.test.ts | 1 | 1 | 0 | 0 | 0 |
| playwright-test-environment.ts | 1 | 1 | 0 | 0 | 0 |

Added support files: is-non-empty-string.ts and is-non-empty-string.test.ts (zero suppressions).
