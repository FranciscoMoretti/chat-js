# W8 local release verification

Historical local evidence: the CLI `1.0.0` and registry `2.0.0` archives below are withdrawn and must not be published. The approved beta versions and completed public-consumer checks are recorded in [beta release verification](chatjs-beta-release-verification.md).

Verified 26 October 2026 in `codex/shadcn-ui-plan`. No package was published and no site was deployed. This report closes W8's local implementation/integration work; publication and a public-command smoke test remain a separate release step.

## Release archives

Built from current worktree source with Bun (`build` in registry and CLI, contract builds through lint preparation), then packed with `bun pm --cwd packages/<name> pack --filename <archive>`. The four archives and machine-readable audit are in `/tmp/chatjs-w8-release`. These are temporary local evidence; recreate them before publication if sources change.

| Package | Version | Files | SHA-256 |
| --- | --- | --- | --- |
| `@chat-js/cli` | `1.0.0` | 1035 | `e727b72ccaaea9d2ae66310e26a9d5711e82659553b1e552ebabbf41725dd25e` |
| `@chat-js/gateways` | `0.2.0` | 23 | `478f135d695812a3fda1b77e5477ad4ef49c9c4b36c28bf9eb3bc5217eb8228e` |
| `@chat-js/registry` | `2.0.0` | 82 | `06932c32916997fe8b4bc0fe7dc624cb51edcee336089110c383f6cd50de3564` |
| `@chat-js/sandboxes` | `0.2.0` | 14 | `1bb4e71f1f8ec42ef36455d6467f7acb7fca3ebcfe9b0cca0a33a047d19753e4` |

The audit inspected all archive member paths, public dependency manifests, common credential/private-key patterns, and the current native presentation files. No environment files, build/test captures, node_modules, local runtime QA routes, or nonpublic package dependencies were found. The CLI contains Trace/CodeBlock, highlighter hook/library, ToolActivity/ToolOutput and PromptForm matching current template bytes; deleted AI-element facades are absent. The internal raw scaffold's gateway workspace placeholder is removed before native initialization by the CLI, as verified by all three standalone generations. It is not a published package dependency or generated-app dependency.

A clean directory installed the CLI tarball using local gateway/sandbox tarball overrides (these versions are not yet published), then invoked the installed CLI's `create --help` successfully. This is a package loading check. Actual app generation and runtime are covered by the [three-case matrix](chatjs-create-local-runtime-verification.md), using the same built CLI/template and locally served registry contracts.

## QA and final review

- Lint, all nine type tasks, 323 CLI tests and 1,207 app unit tests pass.
- Full Create interaction suite plus five native activity tests pass. The native activity matrix covers all eight styles and five icon libraries, keyboard expansion and exact clipboard content.
- All 28 chat-route tests and five shared-component tests pass after the shared presentation changes.
- Sixteen fleet captures reviewed: four Create, four component galleries and eight app-route states, with zero rendering failures. Four approval captures use previous CI baselines; 12 are new captures. Expected cumulative W2–W5 differences remain visible; no additional W8 regression was found. Baselines are unchanged. Build links and Chrome observations are in [Create QA](chatjs-create-qa.md).
- Three generated apps pass exact preset/add/sync/type/runtime/theme parity. Two use real AI Gateway responses; the document case creates and reopens a persisted document. Native highlighted code, clipboard and seven tool states work with generated dependencies. Temporary servers/databases are cleaned up.
- Migration guidance documents theme-only changes versus native source regeneration, the Base UI compatibility boundary, wrapper replacements and behavioral checks. The CLI still forwards native preset/theme arguments unchanged after `--`; no ChatJS theme schema was added.

## Remaining release boundary

Superseded release policy: the user explicitly requires opt-in beta releases, without major version bumps or changes to stable `latest`. Use CLI `0.9.0-beta.0` and registry `0.2.0-beta.0`, both with `--tag beta`. See [beta release verification](chatjs-beta-release-verification.md). Verify the public beta command from a clean consumer before promoting Create. Rebuild/re-audit when packaged input changes. npm authentication may need user action; no publish attempt was made in W8.

OpenRouter completions, actual S3 transfers, OAuth, and external MCP/search/sandbox services are not claimed verified by this local suite. Base UI is the only advertised launch base; full Radix support is W9. The new Create fleet project has no accepted baseline yet; baseline acceptance and CI secret setup were not performed.
