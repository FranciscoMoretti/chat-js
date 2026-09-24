# Developing the eve fork with ChatJS

The package migration is part of [PR #447](https://github.com/FranciscoMoretti/chat-js/pull/447), on `codex/app-owned-branch-prototype`. It consumes `eve` through the npm alias `npm:@chat-js/eve@0.61.0-chatjs.0`. The implementation and native tests are published on [francisco/chatjs-package](https://github.com/FranciscoMoretti/eve/tree/3a7acfe6ba42a8dc9d330132b11856962a675705), based on upstream `eve@0.61.0`, with GitHub-verified signatures and DCO trailers. Native unit tests (9,149), types, invariants, lint, focused integrations, package build and consumer smoke checks passed.

The first scoped release is [published on npm](https://www.npmjs.com/package/@chat-js/eve/v/0.61.0-chatjs.0). `bun.lock` resolves the registry artifact, whose integrity matches the tested tarball. Install it with `bun install --frozen-lockfile`.

## Local loop

Use Node 24+ for both repositories. In the eve checkout:

```sh
pnpm install --frozen-lockfile
pnpm pack:chatjs
node scripts/test-chatjs-package.mjs artifacts/chat-js-eve-0.61.0-chatjs.0.tgz
```

Then, in an isolated ChatJS worktree containing this migration:

```sh
bun run eve:test-package /absolute/path/to/eve/artifacts/chat-js-eve-0.61.0-chatjs.0.tgz
```

The command temporarily installs that archive as `eve`, runs lint, all workspace type checks, the focused eve/MCP tests, and scaffold tests. It restores the manifests and lockfile even on failure. `node_modules` remains on the tested archive; run `bun install --frozen-lockfile` after publication to restore the registry installation. Avoid concurrent dependency edits in the same worktree. The test install skips lifecycle scripts; initialize other workspace dependencies normally before testing if their native build scripts are required.

The scoped package retains the upstream runtime identity for persisted workflow IDs. Fork revisions have versions such as `0.61.0-chatjs.0`; changing the upstream base is a separate upgrade that requires workflow compatibility checks.

Generated apps preserve the exact npm alias. They no longer reconstruct an eve package from a Bun patch. MCP and Postgres still use their existing vendored patched archives. Native approval tests now import the regular built module, without the old Bun patch filename relocation.

## Release workflow

1. Review and retain the native source changes in the fork. Its `CHATJS.md` documents the build, tests and publication workflow.
2. An authenticated owner of the `@chat-js` npm scope publishes the tested archive: `npm publish /absolute/path/to/chat-js-eve-0.61.0-chatjs.0.tgz --access public --tag chatjs`.
3. Run `bun install` in ChatJS, verify the resolved package name/version, and run the same checks against the registry installation.
4. Run `bun template:sync` and `bun template:check`. The former EVE source and compiled patches and their assembler were removed after the first release. Their history remains available in Git.

For subsequent releases, use npm trusted publishing with the fork's `chatjs-package.yml` workflow. It builds and checks a tarball before publishing that exact artifact. Package names and versions must agree in both ChatJS manifests and generated templates. No paid provider calls, existing databases, or live workflow migration are part of these checks.

## Verified locally

The npm consumer smoke test passes for the built scoped tarball. Native checks: 9,149 unit tests passed (one skipped), 44 integration tests passed, type checks passed, invariant guards passed, and all 92 documentation pages compiled. ChatJS's local package command passed lint, all seven workspace type checks, 359 focused runtime tests, and 22 scaffold/vendor tests. The candidate tarball is in the eve checkout's ignored `artifacts/` directory. The published registry artifact has the same integrity as this tested candidate.
