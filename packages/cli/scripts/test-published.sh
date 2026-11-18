#!/usr/bin/env bash
set -euo pipefail

# Release boundary: install from npm and the public registry, without local
# tarball overrides. This deliberately does not use the workspace CLI build.
cli_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ "$#" -ne 0 ] && [ "$#" -ne 3 ]; then
  echo "Usage: $0 [cli-version gateway-version registry-version]" >&2
  exit 1
fi
cli_version="${1:-$(cd "$cli_root" && node -p 'require("./package.json").version')}"
gateway_version="${2:-$(cd "$cli_root/../gateways" && node -p 'require("./package.json").version')}"
registry_version="${3:-$(cd "$cli_root/../registry" && node -p 'require("./package.json").version')}"
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
for package in "@chat-js/gateways@$gateway_version" "@chat-js/registry@$registry_version" "chat-js@$cli_version"; do
  for attempt in {1..60}; do
    if npm view "$package" version --json --prefer-online > "$fixture_root/lookup.json" 2> "$fixture_root/lookup.log"; then
      break
    fi
    if ! grep -q E404 "$fixture_root/lookup.log" || [ "$attempt" = 60 ]; then
      cat "$fixture_root/lookup.log" >&2
      exit 1
    fi
    sleep 10
  done
done

unset CHATJS_REGISTRY_URL CHATJS_EVE_REGISTRY_URL
cd "$fixture_root"
if ! npx --yes "chat-js@$cli_version" create app --yes --no-electron > create.log 2>&1; then
  cat create.log >&2
  exit 1
fi
cd app
if ! bun run test:types > ../types.log 2>&1; then
  cat ../types.log >&2
  exit 1
fi
if ! bun run lint > ../lint.log 2>&1; then
  cat ../lint.log >&2
  exit 1
fi
GATEWAY_VERSION="$gateway_version" REGISTRY_VERSION="$registry_version" node --input-type=module -e '
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const manifest = JSON.parse(await readFile("node_modules/@chat-js/gateways/package.json", "utf8"));
const components = JSON.parse(await readFile("components.json", "utf8"));
assert.equal(manifest.version, process.env.GATEWAY_VERSION);
assert.ok(components.registries["@chatjs"].includes(`@${process.env.REGISTRY_VERSION}/`));
const sandbox = await import("eve/sandbox");
assert.equal(typeof sandbox.DefaultSandbox.environment, "function");
'
echo "Published chat-js@$cli_version: create, typecheck, lint and native sandbox imports passed."
