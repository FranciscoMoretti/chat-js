#!/usr/bin/env bash
set -euo pipefail

cli_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Verify local contracts before publication, including external registry installs.
bun run --cwd "$cli_root" test:gateways
gateway_archive_dir="$(mktemp -d /tmp/chat-js-gateway-package-XXXXXX)"
trap 'kill "${registry_pid:-}" 2>/dev/null || true; rm -rf "$gateway_archive_dir"' EXIT
gateway_archive="$gateway_archive_dir/gateways.tgz"
bun run --cwd "$cli_root/../gateways" build
bun pm --cwd "$cli_root/../gateways" pack --filename "$gateway_archive"
bun "$cli_root/test/serve-registry.ts" "$gateway_archive" "$gateway_archive_dir/address" &
registry_pid=$!
for attempt in {1..100}; do
  test -f "$gateway_archive_dir/address" && break
  sleep 0.1
done
if [ ! -s "$gateway_archive_dir/address" ]; then
  echo "Registry server did not publish its address within 10 seconds." >&2
  exit 1
fi
CHATJS_REGISTRY_URL="$(cat "$gateway_archive_dir/address")"
export CHATJS_REGISTRY_URL


run_case() (
  local package_manager="$1"
  local electron_flag="$2"
  local temp_parent
  local app_name
  local app_dir
  temp_parent="$(mktemp -d "/tmp/chat-js-${package_manager}-${electron_flag}-XXXXXX")"
  trap 'rm -rf "$temp_parent"' EXIT
  app_name="chat-js-app"
  app_dir="$temp_parent/$app_name"

  local create_args=(
    "$cli_root/dist/index.js"
    create
    "$app_name"
    --yes
  )

  if [ "$electron_flag" = "true" ]; then
    create_args+=(--electron)
  else
    create_args+=(--no-electron)
  fi

  (
    cd "$temp_parent"
    npm_config_user_agent="$package_manager/$($package_manager --version)" node "${create_args[@]}"
  )

  test -f "$app_dir/package.json"
  test -f "$app_dir/chat.config.ts"
  if [ "$electron_flag" = "true" ]; then
    test -f "$app_dir/electron/package.json"
    test -f "$app_dir/electron/forge.config.ts"
  else
    test ! -d "$app_dir/electron"
  fi

  pushd "$app_dir" >/dev/null
  case "$package_manager" in
    bun) bun install ;;
    npm) npm install ;;
    pnpm) pnpm install ;;
    yarn) yarn install ;;
    *) echo "Unsupported package manager: $package_manager" >&2; exit 1 ;;
  esac
  node --input-type=module -e '
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/package.json");
const manifest = require("@chat-js/gateways/package.json");
for (const key of Object.keys(manifest.exports)) {
  if (key !== "./package.json") await import("@chat-js/gateways" + key.slice(1));
}'
  popd >/dev/null

  if [ "$electron_flag" = "true" ]; then
    pushd "$app_dir/electron" >/dev/null
    case "$package_manager" in
      bun) bun install ;;
      npm) npm install ;;
      pnpm) pnpm install ;;
      yarn) yarn install ;;
      *) echo "Unsupported package manager: $package_manager" >&2; exit 1 ;;
    esac
    # Preserve the existing packaging smoke test: all managers install, while
    # npm packages Electron once to avoid repeating the expensive Forge build.
    if [ "$package_manager" = "npm" ]; then
      npm run make
    fi
    popd >/dev/null
  fi

)

for package_manager in bun npm pnpm yarn; do
  run_case "$package_manager" false
  run_case "$package_manager" true
done
