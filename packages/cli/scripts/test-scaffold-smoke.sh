#!/usr/bin/env bash
set -euo pipefail

cli_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture="$(mktemp -d)"
cleanup() {
  if [ -n "${registry_pid:-}" ]; then
    kill "$registry_pid" 2>/dev/null || true
    wait "$registry_pid" 2>/dev/null || true
  fi
  rm -rf "$fixture"
}
trap cleanup EXIT

echo "Packing the built CLI and starting the local registry"
if ! (
  cd "$cli_root"
  bun pm pack --destination "$fixture"
) >"$fixture/pack.log" 2>&1; then
  cat "$fixture/pack.log" >&2
  exit 1
fi
bun "$cli_root/test/serve-registry.ts" "$fixture/address" &
registry_pid=$!
for attempt in {1..100}; do
  test -s "$fixture/address" && break
  sleep 0.1
done
test -s "$fixture/address"
export CHATJS_REGISTRY_URL="$(cat "$fixture/address")"
export CHATJS_EVE_REGISTRY_URL="${CHATJS_REGISTRY_URL%/*}/eve/{name}.json"

echo "Installing the CLI archive and creating a standalone Bun app"
cd "$fixture"
printf '{"private":true}\n' > package.json
archives=("$fixture"/chat-js-*.tgz)
if [ "${#archives[@]}" -ne 1 ] || [ ! -f "${archives[0]}" ]; then
  echo "Expected one packed CLI archive" >&2
  exit 1
fi
bun add "${archives[0]}"
export npm_config_user_agent="bun/$(bun --version)"
node node_modules/chat-js/dist/index.js create app --yes --no-electron
cd app
bun run test:types

echo "Loading the generated gateway and EVE sandbox in Node"
test ! -d electron
node --import tsx --input-type=module <<'JS'
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DefaultSandbox } from "eve/sandbox";
import { Gateway } from "./chatjs/providers/gateway.ts";
import { gatewayType } from "./chatjs/providers/gateway-defaults.ts";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(manifest.dependencies["@chat-js/gateways"], undefined);
assert.equal(typeof manifest.dependencies["@ai-sdk/gateway"], "string", "missing Vercel gateway SDK dependency");
assert.equal(existsSync("chatjs/core/gateway/runtime.ts"), true);
assert.equal(gatewayType, "vercel");
assert.equal(new Gateway().type, gatewayType);
assert.equal(typeof DefaultSandbox.environment, "function");
JS
