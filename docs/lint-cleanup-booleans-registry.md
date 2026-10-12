# Registry Strict Boolean Expressions

Scope: canonical `packages/registry/src/**` only. Generated app mirrors were synchronized by the coordinator. Baseline is HEAD before this cleanup. All 19 original disable directives in 16 files removed, including matching enables. No retentions or unresolved sites. Removing these directives exposed 34 diagnostics; all fixed.

| File under packages/registry/src | Original | Final | Evidence |
| --- | --: | --: | --- |
| features/mcp/components/settings/connectors-settings.tsx | 1 | 0 | Optional authentication state must equal true. |
| features/mcp/components/settings/mcp-connect-dialog.tsx | 1 | 0 | Nullish or empty ID does not start authentication; URL requires present connector and nonempty string. Effect continues depending on connector ID, not object identity. |
| features/mcp/components/settings/mcp-create-dialog.tsx | 1 | 0 | Trimmed empty or absent OAuth strings still become undefined; nonempty original strings preserved. |
| features/mcp/features/mcp/composer.tsx | 1 | 0 | Optional disabled state equals true, independently ORed with shared connector ownership. |
| tools/code-documents/editor.tsx | 1 | 0 | Undefined/false remote annotation remains local; only true suppresses save. |
| tools/deep-research/progress-panel.tsx | 1 | 0 | Missing completion, zero/-zero, and NaN timestamps retain zero elapsed fallback; other numbers unchanged. |
| tools/deep-research/task.tsx | 1 | 0 | Present query arrays remain rendered, including empty arrays; messages require present, nonempty strings. |
| tools/generate-image/renderer.tsx | 1 | 0 | Explicit absent schema output guard. |
| tools/get-weather/renderer.tsx | 1 | 0 | Explicit absent schema output guard. |
| tools/retrieve-url/renderer.tsx | 4 | 0 | Unknown values must be nonnull objects before property access; typeof excludes all falsy primitive cases. Explicit absent output guard. |
| tools/retrieve-url/tool.ts | 1 | 0 | Firecrawl extraction uses its existing supplied schema as SDK generic, not a new runtime parse; data requires presence. Empty content/description already equal their empty-string fallback; title uses existing nonempty-string predicate. |
| tools/saved-code-execution/document.tsx | 1 | 0 | canRun is a real boolean from optional action presence, installed capabilities, and recognized language presence; same short-circuit order. |
| tools/sheet-documents/editor.tsx | 1 | 0 | Numeric zero and NaN still serialize as empty fields; other numbers and strings unchanged; missing cell remains empty. |
| tools/vercel-code-execution/tool.ts | 1 | 0 | Explicit optional ownership/abort-signal presence, same awaited lifecycle and cleanup sequence. |
| tools/word-count/renderer.tsx | 1 | 0 | Explicit absent schema output guard. |
| ui/code-execution/interactive-chart-impl.tsx | 1 | 0 | Existing bucket explicitly checked against undefined. Local bucket value preserves the original repeated item.group getter evaluations; no conversion to ??= or Map. |

## Verification

- `bun x oxlint --type-aware packages/registry/src -f json`: zero diagnostics, 202 files, all 600 configured rules.
- `bun run --cwd packages/registry test:unit`: 154 pass, zero fail, 257 assertions across 14 files.
- Formatted the 16 owned files with native oxfmt.
- Integrated types/full lint delegated to coordinator; SDK schema generic specifically flagged for integrated type verification.
- Synced-mirror Chromium verification: 5 files and 27 tests passed, covering registry renderer, search/word-count renderer, MCP settings, Eve tool results, and research task update states. Existing captures exercised through native browser configuration. Non-failing React act warnings emitted by MCP Link/Toast updates; no test changes made.
- `git diff --check -- packages/registry/src`: passed.

No Boolean wrappers, casts, changed config/dependencies, new runtime schema validation, or weakened tests. Other rules' existing suppressions were left untouched.
