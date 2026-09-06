#!/usr/bin/env bash
set -euo pipefail

cli_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
    --no-install
    --package-manager
    "$package_manager"
  )

  if [ "$electron_flag" = "true" ]; then
    create_args+=(--electron)
  else
    create_args+=(--no-electron)
  fi

  (
    cd "$temp_parent"
    node "${create_args[@]}"
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
