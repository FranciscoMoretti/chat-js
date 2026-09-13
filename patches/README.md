# Maintained EVE runtime fork

`eve@0.52.2.patch` is the active Bun dependency patch. `package.json` and `bun.lock` pin it; scaffold generation also verifies the installed package before it vendors a tarball. The baseline is EVE tag `eve@0.52.2` (`247b3f05244893170bcf4dbcf20a2e35e416ccee`). The installed worker and browser client support stream versions 21–28. The old claim that this fork only advanced to version 26 was stale.

The readable source inputs are applied in this order from the EVE repository root:

1. `eve-session-checkpoints.source.patch` (9,607 lines)
2. `eve-collector-inventory.source.patch` from `packages/eve`
3. `eve-approval-receipts.source.patch`

They are not `patchedDependencies` entries. They document the source that must produce `eve@0.52.2.patch`; only the compiled patch is installed by Bun.

## Capability ownership

EVE owns reusable runtime primitives: checkpoint capture/read/restore, bounded transcript restoration, named idle checkpoints, validated fork authorization, explicit sandbox snapshot capability, durable metadata/hook-result/compaction events, and approval receipts. These are candidates for upstream proposals.

ChatJS owns permanent product policy: principal-to-session ownership, immutable operation/retry payloads, model and credit choices, document/file manifests, public-copy access, family deletion, external resource inventory, and UI state. An EVE capability does not authorize a ChatJS source, accept an application operation, or prove deletion. The capability matrix and source-test boundaries are in [the maintenance draft](../docs/upstream-drafts/eve-fork-runtime-maintenance.md).

## Rebuild gate

The source sequence has passed `build:types` and `build:js` in an isolated Node 24 worktree with a new dependency tree populated from the existing local pnpm store. The rebuilt receipt helper and call sites also passed the four existing native approval-contract cases through a temporary test alias. This is useful source-build evidence, but it is not a clean-cache install, a native EVE source-test run, or byte-for-byte equivalence proof.

The broader, test-inclusive `pnpm --filter eve typecheck` was attempted and fails in patched source tests: stale checkpoint snapshot versions, transcript seed/prefix authenticator types, an unused fork-test binding, and compaction/public-channel types. Repair and rerun that source suite before upstreaming or claiming full fork validation. Passing production builds do not close this gate.

```sh
fork_root=/absolute/path/to/chat-js
eve_root=$(mktemp -d)
git clone https://github.com/vercel/eve.git "$eve_root"
cd "$eve_root"
git checkout 247b3f05244893170bcf4dbcf20a2e35e416ccee
node --version # v24 or newer
git apply "$fork_root/patches/eve-session-checkpoints.source.patch"
git -C packages/eve apply "$fork_root/patches/eve-collector-inventory.source.patch"
git apply "$fork_root/patches/eve-approval-receipts.source.patch"
pnpm install --frozen-lockfile
pnpm --filter eve build:types
pnpm --filter eve build:js
```

Use a dedicated pristine package directory for the compiled-patch comparison; do not run `git diff` inside `node_modules/eve`, which is not an EVE repository. Apply the compiled patch to that copy and retain the resulting `diff` report as the review input for the source build:

```sh
published_root=$(mktemp -d)
npm pack eve@0.52.2 --pack-destination "$published_root"
tar -xzf "$published_root/eve-0.52.2.tgz" -C "$published_root"
expected_root="$published_root/package"
git -C "$expected_root" apply --check "$fork_root/patches/eve@0.52.2.patch"
git -C "$expected_root" apply "$fork_root/patches/eve@0.52.2.patch"
diff -ruN "$eve_root/packages/eve/dist/src" "$expected_root/dist/src" \
  > "$published_root/source-build-vs-compiled.diff" || true

# Installed package check after a clean Bun-cache installation.
installed_eve="$fork_root/node_modules/eve"
git -C "$installed_eve" apply --reverse --check \
  "$fork_root/patches/eve@0.52.2.patch"
```

The reverse check proves the installed package contains the compiled patch. The `diff` is not yet a passing equivalence assertion: the source build uses normal nested helpers while the installed patch relocates helpers and rewrites imports at the package root for Bun 1.3.11. Turn it into a failing verifier only after the relocation transform is explicit and it permits no other source-to-dist delta. Then repeat with a new Bun cache and fresh package installation. Remove the relocation only after a supported Bun version passes that fresh install and generated-output check with ordinary nested paths.

## Packaging and upstreaming

The template helper reverse-checks the installed patch, then packages it as `vendor/eve-0.52.2.tgz`. This makes npm, Bun, pnpm, and Yarn scaffolds receive the same checked runtime. Archive metadata declares `microsandbox@^0.6.18` so npm enforces the peer used by the maintained snapshot lifecycle.

Upstream the fork as independent EVE slices: checkpoint/fork protocol and authorization; transcript seed/imported-prefix fork; durable events; named checkpoint readiness; sandbox snapshots/local identity; then the collector attribute separately. Each slice needs its native regression, wire/version contract, and explicit retention owner. No issue or change has been published.

Remove a local slice only after an upstream release has the same public contract, its focused regression passes against that release, the fresh build shrinks the compiled patch, and ChatJS policy tests remain green. Do not delete product-policy tests merely because an EVE primitive lands upstream.
