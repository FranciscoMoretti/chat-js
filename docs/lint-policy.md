# Practical lint policy

The repository follows the pinned Ultracite Oxlint defaults for core JavaScript/TypeScript, React, Next.js, and TanStack. The root configuration is `oxlint.config.ts`; `apps/chat/oxlint.config.ts` carries the same presets into standalone scaffolded applications. Rules disabled by those presets stay disabled. There is no separate enable-all restriction list. The TanStack preset supplies Query rules and scoped Router defaults; this does not require applications to adopt TanStack Router.

Type-aware linting remains enabled. The Vitest preset is not enabled: the repository uses both Bun and Vitest, and its blanket test-file matching would apply Vitest-specific conventions to Bun tests.

## Preset behavior

- The TanStack preset disables `sort-keys` because callback property order can affect type inference.
- Test files retain the core preset's exceptions for `no-empty-function` and `promise/prefer-await-to-then`; mock factories and promise-based fixtures need these forms.

## Repository configuration

Repository-specific lint configuration is limited to type-aware checks, ignored library-installed/generated/evaluation files, and exact filename exceptions preserving the EVE-discovered `deepResearch.ts` and `webSearch.ts` tool IDs where applicable. Pinned Oxlint reports filename diagnostics at offset zero, where inline suppression comments do not work.

The formatter retains `sortImports: false` in the root and standalone-app Oxfmt configurations. Formatting must preserve module evaluation order. Named bindings can still be arranged through deliberate source changes when their semantics are understood.

## Source exceptions

Keep a source exception only when its rule is enabled and the affected framework, external API, or intentional test contract requires it. Give the smallest useful scope and explain the concrete reason beside the directive. A passing lint run checks the active rules; it does not certify an exception's rationale.

Remove disabled rule names from mixed directives while preserving the remaining rules and their targets. Remove empty disable/enable comments. Retain behavioral fixes already made during the earlier cleanup; changing lint policy does not undo those improvements.

Stock defaults permit native async/await, optional chaining, named exports, object spread, and ternary expressions. These constructs do not need the previous policy's suppression comments. This does not relax independently enabled Promise safety, type safety, or React correctness checks.

## Generated source

Oxlint and Oxfmt exclude library-installed `components/ai-elements` and `components/ui`, but keep their local `extra/` wrappers, `*.test.*`/`*.spec.*` files, and `__tests__/` directories checked. Generator-owned registration modules under `features/installed*.ts` and `chatjs/tools` are also excluded. These are config-level exclusions, not per-rule source suppressions. Custom registrations (`custom-tools.ts` and `custom-ui.ts`), feature implementations, and generator source remain checked. Type checking still covers excluded TypeScript files.

Ultracite's inherited exclusions cover standard generated names (`*.generated.*`, `*.gen.*`, and `*.auto.*`), generated directories, framework build output, `next-env.d.ts`, and lockfiles. Oxfmt also excludes Drizzle's generated migration metadata; authored schema and migration logic remain checked.

CLI emitters must not recreate obsolete suppressions. Generated registration modules preserve their public bindings, initializer order, and existing value/type export layout. Only exceptions required by an enabled rule are emitted.

Edit registry modules at their canonical source and regenerate installed copies. Keep root and standalone lint/format configurations aligned so freshly scaffolded applications use the same policy.

## Verification

Run `bun lint`, `bun test:types`, and the relevant tests after code changes. Use the repository's UI verification workflow for rendered changes. Generator changes also need focused generation/scaffold tests and installed-output parity checks.

Count suppression memberships, diagnostics, and reviewed exceptions separately. One comment can name multiple rules or cover multiple findings; none of those counts is a bug count.

## Historical audits

The earlier enable-all campaign and its issue inventory are historical evidence, not the current rule contract or a requirement to re-enable stock-disabled rules. See [cleanup history](oxlint-cleanup-progress.md), the [module declaration audit](oxlint-unambiguous-721.md), and the [ternary audit](oxlint-prefer-ternary-807.md) for their original scope and validation. Review remaining exceptions against the current configurations.
