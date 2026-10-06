#!/usr/bin/env bash
set -euo pipefail
proof_dir="$(cd "$(dirname "$0")" && pwd)"
shared_harness="${1:?Pass the Lane D tests/eve-retirement-runtime directory}"
source_repo="${2:-https://github.com/vercel/eve.git}"
node_binary="${EVE_TEST_NODE:-node}"
if [[ "$("$node_binary" --version)" != "v24.20.0" ]]; then
  echo 'This baseline proof requires Node 24.20.0; set EVE_TEST_NODE.' >&2
  exit 1
fi
runtime_root="$(mktemp -d "${TMPDIR:-/tmp}/lane-b-released.XXXXXX")"
cp "$shared_harness/package.json" "$shared_harness/bun.lock" "$runtime_root/"
bun install --cwd "$runtime_root" --frozen-lockfile
(cd "$runtime_root" && git apply "$proof_dir/runtime-fixture.patch")
"$node_binary" "$runtime_root/runtime-proof.mjs" "$runtime_root" stock
git clone --no-hardlinks "$source_repo" "$runtime_root/source"
git -C "$runtime_root/source" checkout --detach fab8ba1424eddfdedd6a177cac21710258da0e81
git -C "$runtime_root/source" apply "$proof_dir/receipt.patch"
# Replace only three isolated distribution modules from the patched release
# source. Atomic rename avoids modifying any package-manager hardlinked cache.
bun --eval '
const {rename}=await import("node:fs/promises");
const root=process.argv[1];
const compiler=new Bun.Transpiler({loader:"ts",target:"node"});
for(const name of ["context/tool-approval-receipts","execution/tool-auth","harness/tool-loop"]){
 const source=await Bun.file(`${root}/source/packages/eve/src/${name}.ts`).text();
 const target=`${root}/node_modules/eve/dist/src/${name}.js`;
 await Bun.write(`${target}.lane-b`,compiler.transformSync(source));
 await rename(`${target}.lane-b`,target);
}' "$runtime_root"
"$node_binary" "$runtime_root/runtime-proof.mjs" "$runtime_root" patched
printf 'Isolated published-package experiment: %s\n' "$runtime_root"
