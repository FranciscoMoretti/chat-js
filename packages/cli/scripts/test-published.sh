#!/usr/bin/env bash
set -euo pipefail

# Release boundary: install from npm and the public registry, without local
# tarball overrides. This deliberately does not use the workspace CLI build.
cli_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ "$#" -ne 0 ] && [ "$#" -ne 2 ]; then
  echo "Usage: $0 [cli-version registry-version]" >&2
  exit 1
fi
cli_version="${1:-$(cd "$cli_root" && node -p 'require("./package.json").version')}"
registry_version="${2:-$(cd "$cli_root/../registry" && node -p 'require("./package.json").version')}"
fixture_root="$(mktemp -d /tmp/chatjs-published-XXXXXX)"
cleanup() {
  if [ "${CHATJS_KEEP_PUBLISHED_FIXTURE:-0}" = 1 ]; then
    echo "Preserved published installation: $fixture_root"
  else
    rm -rf "$fixture_root"
  fi
}
trap cleanup EXIT

# npm publication can finish before the versions are publicly readable.
for package in "@chat-js/registry@$registry_version" "chat-js@$cli_version"; do
  for attempt in {1..60}; do
    if npm pack "$package" --dry-run --json --prefer-online > "$fixture_root/lookup.json" 2> "$fixture_root/lookup.log"; then
      break
    fi
    if ! grep -Eq 'E404|ETARGET' "$fixture_root/lookup.log" || [ "$attempt" = 60 ]; then
      cat "$fixture_root/lookup.log" >&2
      exit 1
    fi
    sleep 10
  done
done

unset CHATJS_REGISTRY_URL CHATJS_EVE_REGISTRY_URL
# npm metadata, tarballs and the CLI's public registry CDN propagate separately.
curl --fail --silent --show-error --location --max-time 20 \
  --retry 60 --retry-delay 10 --retry-max-time 600 --retry-all-errors \
  "https://unpkg.com/@chat-js/registry@$registry_version/dist/r/memory-storage.json" \
  --output "$fixture_root/memory-storage.json"
cd "$fixture_root"
if ! npx --yes "chat-js@$cli_version" create app --yes \
  --installation '{"gateway":"vercel","plugins":[],"tools":["deep-research"],"storage":{"source":"memory"}}' \
  -- --preset b27I2r8C --base base --no-rtl --pointer > create.log 2>&1; then
  cat create.log >&2
  exit 1
fi
cd app
npx --yes "chat-js@$cli_version" add --plugin feedback --yes
test -f chatjs/plugins/feedback/plugin.json
npx --yes "chat-js@$cli_version" remove --plugin feedback --yes
test ! -e chatjs/plugins/feedback/plugin.json
test -f chatjs/plugins/feedback/feedback-schema.ts
if ! bun run test:types > ../types.log 2>&1; then
  cat ../types.log >&2
  exit 1
fi
if ! bun run lint > ../lint.log 2>&1; then
  cat ../lint.log >&2
  exit 1
fi
REGISTRY_VERSION="$registry_version" node --input-type=module -e '
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const components = JSON.parse(await readFile("components.json", "utf8"));
assert.equal(manifest.dependencies["@chat-js/gateways"], undefined);
assert.equal(existsSync("node_modules/@chat-js/gateways"), false);
assert.equal(existsSync("chatjs/core/gateway/runtime.ts"), true);
assert.ok(components.registries["@chatjs"].includes(`@${process.env.REGISTRY_VERSION}/`));
assert.equal(existsSync("agent/tools/deepResearch.ts"), true);
assert.equal(existsSync("chatjs/tools/deep-research/renderer.tsx"), true);
const sandbox = await import("eve/sandbox");
assert.equal(typeof sandbox.DefaultSandbox.environment, "function");
'
echo "Published chat-js@$cli_version: Deep Research install, Feedback add/remove, typecheck, lint and native sandbox imports passed."
