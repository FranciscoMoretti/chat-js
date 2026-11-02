# Developing the eve fork with ChatJS

ChatJS consumes the maintained [eve fork](https://github.com/FranciscoMoretti/eve/tree/francisco/chatjs-package) through an exact npm alias. The upstream baseline is eve 1.0.0-rc.1. The fork README inventories retained patches; `package.json` and `bun.lock` identify the application release. Use Node 24+, pnpm in the fork, and Bun in ChatJS.

## Prepare a release

1. Start from an exact, clean, reviewed fork commit and record its SHA.
2. In the release checkout, set `packages/eve/package.json` to the intended scoped prerelease **before building**. Keep its workspace name `eve` for the build. Set `EVE_PACKAGE_DEPENDENCY_URL` to the intended `npm:@chat-js/eve@<version>` alias.
3. Run `pnpm install --frozen-lockfile` and `pnpm --filter eve build`. This emits declarations and stamps the runtime version. Run the relevant native regression tests with their explicit Vitest tier configurations.
4. The build stages the distributable package in `packages/eve/.package`, including resolved dependencies and licenses. Do not pack the source directory or commit an archive.
5. Change only the staged distribution metadata: set the name to `@chat-js/eve`, the repository to the fork, `gitHead` to the source SHA, and `publishConfig` to public access with the intended prerelease tag. Run `npm pack --ignore-scripts ./packages/eve/.package --pack-destination <external-directory> --json` from the fork root.
6. Verify that the staged manifest version equals the built runtime's `readStampedPackageVersion()`. Changing the manifest after building without matching the stamped version can leave fresh sessions waiting because the worker treats them as belonging to another version.
7. Test a clean install and actual ChatJS create/send/fork/restart flows against that exact archive. The scoped workflow-identity behavior lives in the fork source; no compiled EVE dependency patch is needed. Keep archives, credentials, captured logs and runtime state outside Git.

## Publish and adopt

Publication requires explicit authorization and npm authentication. Publish only the verified archive with `npm publish <archive> --access public --tag chatjs-rc`; do not change `latest`. A successful upload alone is insufficient: confirm registry availability and compare the downloaded artifact's SHA-512 integrity with the tested archive.

Update all consumers to the published version, then run `bun install` and verify `bun install --frozen-lockfile`. Remove temporary local package installations so they cannot shadow the registry dependency. Run `bun lint`, `bun test:types`, relevant regression tests and the required runtime checks before merging the application update. Document the source SHA, registry integrity and verification limitations in the fork README and companion PR.

Fork prerelease versions do not name upstream sandbox images. Select the sandbox image independently for the configured provider; do not use the scoped package version as an image tag. Fresh-state migrations and workflow compatibility are separate from publishing; a release does not authorize a live database migration or deployment.

## Historical evidence

The original 0.61.0 migration in [#447](https://github.com/FranciscoMoretti/chat-js/pull/447) recorded 9,149 native unit tests, 44 integration tests, 359 focused ChatJS tests and 22 scaffold/vendor tests. Those results apply to that recorded source and artifact, not later releases. The former `pack:chatjs`, `CHATJS.md` and `chatjs-package.yml` instructions no longer describe the maintained 1.0.0-rc.1 source tree.
