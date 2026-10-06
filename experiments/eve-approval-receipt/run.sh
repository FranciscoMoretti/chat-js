#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${EVE_TEST_NODE:-}" ]]; then export PATH="$(dirname "$EVE_TEST_NODE"):$PATH"; fi

# Run from any directory. A fresh temporary clone is the only modified checkout.
proof_dir="$(cd "$(dirname "$0")" && pwd)"
source_repo="${1:-https://github.com/vercel/eve.git}"
experiment_dir="$(mktemp -d "${TMPDIR:-/tmp}/chatjs-approval-proof.XXXXXX")"
git clone --no-hardlinks "$source_repo" "$experiment_dir/eve"
cd "$experiment_dir/eve"
git checkout --detach fab8ba1424eddfdedd6a177cac21710258da0e81
python3 - <<'PY'
import json
import re
from pathlib import Path
root = Path.cwd()
catalog = {}
section = (root / 'pnpm-workspace.yaml').read_text().split('catalog:\n')[1].split('\noverrides:')[0]
for line in section.splitlines():
    match = re.match(r'  (?:"([^"]+)"|([^:]+)): "([^"]+)"', line)
    if match:
        catalog[match[1] or match[2]] = match[3]
# Pin the proof's real AI SDK dependencies rather than re-resolving their ranges.
catalog.update({'ai': '7.0.106', '@ai-sdk/provider': '4.0.17', '@ai-sdk/provider-utils': '5.0.44'})
path = root / 'package.json'
package = json.loads(path.read_text())
package.update({'workspaces': ['packages/*'], 'catalog': catalog, 'overrides': {'zod': '4.5.4'}})
path.write_text(json.dumps(package, indent=2) + '\n')
PY
bun install --ignore-scripts
# Bun 1.3.11 can retain this transitive link despite the override; EVE's vendor
# guard requires one Zod instance. Keep the adjustment inside this disposable clone.
ln -sfn "$PWD/node_modules/.bun/zod@4.5.4/node_modules/zod" \
  node_modules/.bun/@vercel+cli-config@0.2.0/node_modules/zod
bun run --cwd packages/eve build:compiled
git apply "$proof_dir/counterexample.patch"
cd packages/eve
bun x vitest run --config vitest.lane-b.config.ts src/harness/counterexample.lane-b.integration.test.ts
cd ../..
git apply "$proof_dir/receipt.patch"
cd packages/eve
bun x vitest run --config vitest.lane-b.config.ts
for phase in ingest settle execute; do
  LANE_B_CHECKPOINT="$experiment_dir/checkpoint.json" LANE_B_PHASE="$phase" \
    bun x vitest run --config vitest.lane-b.config.ts -t 'process checkpoint'
done
printf 'Proof checkout retained at %s\n' "$experiment_dir/eve"
