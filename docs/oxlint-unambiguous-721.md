# Import/unambiguous exception audit (#721)

The Electron declaration now uses an external declaration module with all three declarations inside `declare global`. The root and app configurations retain only the CommonJS Forge launcher exception; `import/unambiguous` remains `error` elsewhere. This audit starts at `8aa25747122b53e7b4cbd2ed394db0ca0e1429e6` and compares the original issue snapshot `e56e9b74be3ce464b7f49bb4d8367475c8000193`.

## Ownership and disposition

The explicit release manifest `786-released-721-8aa2574712/manifest.json` released both source paths and reserved three configuration paths with no active edits. All five SHA-256 hashes matched before editing. Only the two configuration overrides and `apps/chat/electron.d.ts` changed; `apps/chat/oxlint-policy.ts` and `apps/electron/scripts/run-forge.cjs` stayed byte-identical.

The released #786 declaration delta was ported as three bounded changes: readonly auth-state callback data, readonly error-context callback data, and readonly provider options. Its obsolete suppression was removed. Both auth types remain global, all bridge properties retain their optionality, the status union and null sentinel remain intact, and the bridge remains a Window augmentation rather than a cross-runtime global. The old launcher reference was not applied: current #802 `process.exitCode` behavior is preserved.

## Counts and actual paths

These are configuration exceptions, not inline memberships or lint findings.

| Measure                                      | Before | After |
| -------------------------------------------- | ------ | ----- |
| Inline `import/unambiguous` memberships      | 0      | 0     |
| Root override patterns                       | 2      | 1     |
| App override patterns                        | 2      | 1     |
| Distinct canonical source paths matched      | 2      | 1     |
| App patterns matching the canonical app tree | 1      | 0     |
| Generated app launcher pattern matches       | 1      | 1     |

Before: root patterns were `apps/electron/scripts/run-forge.cjs` and `apps/chat/electron.d.ts`; the app patterns were `electron.d.ts` and `electron/scripts/run-forge.cjs`. Oxlint's printed configuration expands the basename-only declaration pattern to `**/electron.d.ts`. Removing it also removes that wider basename match. The app launcher pattern has no matching file under canonical `apps/chat/`; it is required in the generated layout.

After: root retains literal `apps/electron/scripts/run-forge.cjs`; app retains literal `electron/scripts/run-forge.cjs`. Both printed configurations retain the default severity `deny`. The generated layout was produced through the real `scaffoldElectron` helper after template synchronization, not inferred from the pattern. Its launcher and declaration hashes match canonical source. Its normalized configuration retains exactly the same unambiguous default and launcher override as the app configuration. Scaffold normalization also enables type-aware linting and removes the repository-only EVE fixture filename exception; raw whole-config hashes therefore differ by those expected transforms.

Oxlint's inherited ignore patterns were preserved in the native rule probes. Neither target is ignored. The generated layout matches its launcher pattern; an adjacent script remains denied. Temporary fixture paths used their canonical `/private/tmp` spelling: using `/tmp` for the configuration path while Node's cwd resolves to `/private/tmp` prevents slash-containing overrides from matching in this pinned tool.

## Native rule and source-comment controls

Pinned [Oxlint 1.82 source](https://raw.githubusercontent.com/oxc-project/oxc/oxlint_v1.82.0/crates/oxc_linter/src/rules/import/unambiguous.rs) checks module syntax and reports `Span::default()`. Native probes under Node 24 confirmed zero offset and zero length on the original declaration and launcher when their overrides were removed. The neighboring-script control remained denied with overrides present.

File, next-line, and same-line source disable directives each failed to suppress the diagnostic and each produced an unused-directive error. The module-syntax positive control passed. The launcher therefore needs a configuration override instead of an ineffective source comment.

Adding `export {}` alone loses Window and both global auth types. Wrapping only Window loses both auth types. Strict TypeScript 6 compiler probes (`skipLibCheck: false`, DOM library, empty automatic type list) checked both script and module consumers: original and candidate had zero diagnostics; marker-only controls had ten diagnostics each; Window-only controls had four each. Negative consumer checks reject an invalid auth status, numeric provider, unguarded optional bridge access, and `globalThis.electronAPI`.

The empty export makes `declare global` legal inside an external module, following [TypeScript's global augmentation semantics](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#global-augmentation). It exports no runtime value. At the end of the declaration it requires two explained source memberships, `import/no-named-export` and `unicorn/require-module-specifiers`; there are no new `import/unambiguous` memberships. Moving it to the end satisfies `import/exports-last` without suppression.

## Runtime and verification

Environment: Bun 1.3.11; Node 24.20.0 selected explicitly in PATH; frozen-lockfile installation passed with lockfile unchanged. Oxlint is 1.82.0. No production application build was used to type-check.

Native Node subprocess controls exercised canonical and generated launcher layouts serially. Both passed root-candidate precedence, local-candidate fallback, argv with spaces and flags, environment forwarding, inherited stdin/stdout/stderr, unchanged cwd and executable, child exit status 7, missing-entry status 1, and null status after child SIGTERM mapping to 1. An ESM export appended to `.cjs` fails Node parsing; renaming to `.mjs` fails synchronous `require`. The installed real Forge launcher returned version 7.11.1.

- Final `bun lint`: passed after resolving the empty-export rules; includes formatting, native lint, docs doctor, and demo parity.
- One final `bun test:types --force`: seven successful tasks, zero cached.
- Relevant lint-policy, scaffold-content, scaffold-contract, and template-snapshot tests: 16 passed, zero failed, 209 assertions across six files.
- Template synchronization and `bun scripts/sync-template.ts --check`: passed.
- Strict declaration consumer controls and native subprocess/configuration controls: passed.

No new repository tests were added: real consumer type checks protect the scope change, and frozen native counterfactuals record the configuration and launcher contracts without duplicating production literals in a permanent test.

## Limitations and remaining obligations

The separate Electron TypeScript 5.8 project check reports an existing `ProcessEnv` error in `apps/electron/src/config.ts:31` because `ELECTRON_APP_URL` is required by a readonly projection. Compiling that project with the frozen original declaration through a compiler read-file override yields the identical single diagnostic. This is outside the released #721 scope.

A targeted, full-configuration lint of the generated declaration and `.cjs` launcher reports 25 existing type-aware unsafe-value diagnostics on the launcher. Counterfactual re-enablement adds exactly the expected single unambiguous finding and leaves those 25 diagnostics unchanged. This probe proves override membership, not a clean generated project lint; the unchanged `.cjs` program inclusion/type-discovery boundary remains a separate obligation.

Windows flags were forwarded verbatim on macOS arm64; native Windows execution, packaging, and signal semantics were not tested. No push, PR, merge, issue closure, or watcher was performed. The immutable commit and evidence manifest are returned for independent parent review.
