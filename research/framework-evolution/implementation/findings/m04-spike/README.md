# M04 bounded scope and service experiment

Disposable research; no production exports. Tests prevent concrete cross-view failures: shared path/draft mutation, stale send clearing later edits, stale rebind completion, wrong-target controls and duplicate/cross-caller query use. Real local Thread, Zustand and TanStack Query; recording execution service. There is no Eve, network, mounted React, actual panel lifecycle or browser storage proof. The panel-removal assertion models subscription disposal only.

Baseline `18db694b9b67263904707a85f93673f494ea0e6d`, Bun 1.3.11, TypeScript 6.0.2, ai 7.0.93, Zustand 5.0.12, TanStack Query 5.97.0, React 19.2.3, all from existing lockfile. No dependency changes.

From repository root:

```sh
bun install --frozen-lockfile
# Resolve the research fixture's imports from the existing app dependencies.
ln -s ../../../../../apps/chat/node_modules research/framework-evolution/implementation/findings/m04-spike/node_modules
bun test research/framework-evolution/implementation/findings/m04-spike/scope.test.ts
bun apps/chat/node_modules/typescript/bin/tsc -p research/framework-evolution/implementation/findings/m04-spike/tsconfig.json
```

Skip `ln` if the ignored link already exists. Normal install here failed in existing macos-alias native lifecycle because node-gyp could not resolve nopt. `bun install --frozen-lockfile --ignore-scripts` completed dependency installation for this source-only proof; this is not Electron/native-addon validation.

Observed: 5 tests / 17 assertions passed; standalone inference check passed, including negative `@ts-expect-error` cases for unavailable model and invalid default. `types.ts` is compile-only and must not execute. Root `bun lint` and `bun test:types` passed via Turbo cache; those tasks exclude these research source files, so standalone fixture typecheck is separate. See main report for further integration acceptance.

A selected-path follow guard must eventually include explicit selection generation (including away/back) and unmount lifecycle. This fixture uses binding generation for rebinds; it does not claim production-complete concurrency or duplicate-submit handling. That belongs in the accepted runtime operation contract and mounted view acceptance.
