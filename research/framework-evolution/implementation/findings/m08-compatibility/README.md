# Compatibility proof against actual M07 source

```sh
bun run proof
bun matrix.ts
```

Requires Bun 1.3.11, Git, network for pinned packages, and a local repository containing M07 commit `b4f11884371768836dc5d84498a477b1ed19a07b`. By default the script reads `/Users/fran/.codex/worktrees/7f9a/chat-js`; set `M07_SOURCE` to another local checkout containing that commit. It uses `git show`, never modifies that checkout, and never reads its environment files. All generated applications live in unique temporary directories deleted on exit.

No app server, Eve build, provider request, database or browser is started. Next route type generation and TypeScript compilation run, not production builds. Bun is used for package installation/scripts; this does not change M07's Node 24+ requirement for actually running Eve.

`proof.ts` copies the pinned runtime source/config/lock and generates three test targets:

1. Unmodified M07 app runtime source.
2. Text-only: removes `confirm_note`, its output schema and specialized projection/UI references, preserving shared pending-input handling and application authorization.
3. External source substitution: replaces the authored model with `@ai-sdk/openai-compatible@3.0.44`, and replaces the identity issuer with `acme-host`. The model base URL is `.invalid`: no service behavior is claimed. This is source-level substitution, not a newly executed external registry install (see existing M08 registry/R04 proofs).

Each target runs its actual Next/TypeScript command, shared identity conformance checks and compile-only negative cases using M07's inferred types. Tool variants also validate serialized output. A deliberately type-correct always-allow identity implementation must fail the shared tests. An unsuppressed invalid tRPC binding must make the compiler fail, proving the negative fixture is included. Secrets used for signing are public fixture-only strings authored in the test; no real credentials are read.

The note tool has no exclusive npm dependency in M07: Eve and Zod remain needed by selected execution/router functionality. Source removal is not a reason to prune shared packages. Original and text-only lock hashes therefore match. The external model graph has a new lock hash; it does not imply a live provider guarantee or elimination of Eve's vendored providers.

`evidence.json` records the observed 3 typechecks, 11 passing tests / 42 assertions, compiler-negative rejection per target, 4 semantic rejections and package pins/lock hashes. Existing source declarations plus `@ts-expect-error` cases demonstrate identity, inferred binding, UI data and model shape boundaries; these are not new production plugin interfaces.

`matrix.ts`/`matrix.json` encode a proposed integration plan. Coverage checks ensure each named high-risk interaction has a scenario and prove removal of the full-reference row leaves a gap. They do not mark planned/live-unverified scenarios as passed. The boundary-impact example is deliberately small and explicit, not an automatic source dependency analyzer or exhaustive pairwise generator.
