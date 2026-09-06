# M08 selected CLI delivery

Validated locally on 2026-09-06, based on M07 `688c7e94`, with published
Eve 0.52.1, shadcn 4.21.0, Next 16.3.0, AI SDK 7.0.93 and Node 24.
Implementation: `packages/cli/src/selection`, `packages/cli/build-registry.ts`
and the ordinary source composition in `examples/minimal-next`.

## Delivered behavior

- Opt-in `create --minimal` and `create --selection` share one JSON schema.
  The default full-demo path is preserved. No website migration is included.
- Public shadcn resolution/materialization installs universal registry items.
  The CLI packages its first-party items and serves them over a temporary
  loopback namespace; external namespaces and direct URLs use the same path.
- Preflight validates capability requirements, competing providers, target
  collisions, exact dependency conflicts and composition references. Generated
  source, rather than metadata alone, establishes TypeScript compatibility.
- TypeScript composition is developer-owned. Additions install new files and
  dependencies, then propose composition and changed same-path registry source.
  The proposed source is typechecked in a copy of the current app. Observed file
  hashes distinguish upstream source changes from edits to unchanged source.
  The next proposal set replaces the old generated set. Add is not transactional
  and does not prune old dependencies or source.
- The minimal recipe omits authored optional tools and unselected direct
  dependencies. Published Eve `disableTool()` declarations remove framework
  defaults from the composed toolset. They do not remove vendor implementations
  or transitive packages from Eve itself.
- Paired tools share browser-safe Zod output contracts with schema-inferred lazy
  React renderers. Malformed output and renderer failures have a fallback.

## Verification

`bun packages/cli/tests/selected-app.ts` exercises the built Node CLI in an
independent directory and an independent HTTP registry. It passed:

1. Minimal creation/install/typecheck and omission assertions.
2. Eve compilation with no selected tools produces an empty tool list.
3. External weather backend plus lazy renderer, frontend-only banner and its
   dependency install through the same registry contract.
4. Developer composition survives add; proposed composition typechecks.
5. An unadopted A-to-B-to-A layout sequence clears the stale B proposal.
6. External layout replacement preserves edits and compiles after adoption.
7. A broken same-path identity replacement fails typechecking even while the
   old valid implementation remains untouched; a valid replacement is proposed,
   typechecked and adopted.
8. An incompatible renderer output type is rejected. Malformed values do not
   load the renderer, and inherited-object tool names use the unknown fallback.
9. The expanded Eve build lists exactly `confirm_note` and `weather`.

These credential-free checks are included in the `Selected App Contracts` CI
job. Eve evaluates channel modules during compilation; the fixture supplies an
unreachable database URL to construct the lazy Postgres client, without a live
service or provider call. This is an execution compilation check, not a Next
production build used merely for typechecking.

Local checks also passed: root `bun lint`, root `bun test:types`, 42 CLI tests
(333 assertions), example lint/types, and the two database tests (11 assertions)
copied into the generated app so they import its actual binding implementation.
Root types initially found missing thread declarations from a cached task;
building the local thread package restored them and the root check passed.
The dedicated CLI typecheck covers the new selection surface: the legacy CLI's
broader config-helper imports still have existing app-alias/type errors.

Live verification used a disposable loopback PostgreSQL database and the
generated app, with authorized credentials kept in ignored environment files:

- Authenticated creation/streaming and 28 negative authorization/CSRF checks.
- Pending approval preserved across graceful restart of both Next and Eve.
- Stable replay event IDs, recovered pending input, validated output and a
  continuing real model reply.
- Accepted cooperative cancellation, durable `turn.cancelled`, and a subsequent
  reply observed through M07's catch-up path.
- Browser renders the external layout/banner, weather output and confirmed
  note. React introspection identifies the two lazy result boundaries; Next's
  MCP reports no compilation or runtime errors.
- An initial 16,001-character message shows validation feedback without saving
  a pending operation. This fixes the imported M07 retry-poisoning issue while
  retaining valid operations after ambiguous failures.

The initial natural-language approval prompt received model clarification, so
the mechanics proof uses an explicit tool request. The local Postgres helper
also hit the platform's Unix socket path limit in a long temporary directory;
the isolated harness used `/tmp` for its socket. Neither is represented as a
universal provider or deployment guarantee.

Independent standards and spec reviewers found three issues: invalid initial
message persistence, missing same-path provider proposals, and stale proposals.
All were fixed and the reviewers accepted the focused follow-up changes.

## Remaining upstream and scope boundaries

- Ambiguous Eve session creation is fail-closed and requires operator
  reconciliation. No atomic distributed create-once guarantee is claimed.
- Cancellation is cooperative; it does not imply immediate model abortion or
  rollback of external effects. The next command uses replay catch-up.
- Historical branching is outside this linear slice and does not block it.
- Only explicit-target universal registry items are supported by the selection
  path; arbitrary UI transforms and external setup hooks are not implemented.
- Metadata cannot prove dynamic mounted identity, model tool support, semver
  compatibility, service provisioning or runtime behavior. Contract conformance,
  generated-source checks and representative live integration coverage work
  together; no claim covers every theoretical permutation.
- Source hashes are an audit receipt, not a new lock/version resolver. Use
  immutable external URLs for reproducibility; Bun locks package resolutions.
- No deployment, package publication, upstream submission or P1 migration is
  part of this delivery. UI P0/P1 remains in its own task/PR.
