#!/usr/bin/env bash
set -euo pipefail

# Network integration: the real native CLI and registry generate a standalone app.
# Generation needs no service credentials. Opt into an isolated local runtime check
# with CHATJS_NATIVE_RUNTIME=1 and a loopback CHATJS_NATIVE_POSTGRES_URL.
# CHATJS_NATIVE_SCENARIO=minimal checks the Vercel gateway without optional features.
cli_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
shadcn_cli="$(cd "$cli_root" && node --input-type=module -e 'import { createRequire } from "node:module"; console.log(createRequire(process.cwd() + "/package.json").resolve("shadcn"))')"
fixture_root="$(mktemp -d /tmp/chatjs-native-create-XXXXXX)"
export CHATJS_NATIVE_FIXTURE="$fixture_root"
export CHATJS_NATIVE_PRESET="${1:-b27I2r8C}"
export CHATJS_NATIVE_RTL="${CHATJS_NATIVE_RTL:-0}"
direction=(--no-rtl)
if [ "$CHATJS_NATIVE_RTL" = 1 ]; then direction=(--rtl); fi
export CHATJS_NATIVE_BASE="${CHATJS_NATIVE_BASE:-base}"
export CHATJS_NATIVE_SCENARIO="${CHATJS_NATIVE_SCENARIO:-uploads}"
case "$CHATJS_NATIVE_SCENARIO" in
  minimal) installation=(--gateway vercel --no-attachments --no-documents) ;;
  full) installation=(--gateway vercel --no-attachments --projects --mcp --observability vercel-analytics,vercel-speed-insights) ;;
  documents) installation=(--gateway vercel --no-attachments) ;;
  uploads) installation=(--sandbox-provider vercel --gateway openrouter --attachments --storage-provider s3 --storage-config '{"bucket":"chatjs-native-smoke"}') ;;
  *) echo "CHATJS_NATIVE_SCENARIO must be minimal, documents, full or uploads" >&2; exit 1 ;;
esac
cleanup() {
  kill "${registry_pid:-}" 2>/dev/null || true
  wait "${registry_pid:-}" 2>/dev/null || true
  if [ -f "$fixture_root/template-package.json" ]; then
    cp "$fixture_root/template-package.json" "$cli_root/templates/chat-app/package.json"
  fi
  if [ "${CHATJS_KEEP_NATIVE_FIXTURE:-0}" = 1 ]; then
    echo "Preserved native Create fixture: $fixture_root"
  else
    rm -rf "$fixture_root"
  fi
}
trap cleanup EXIT

bun run --cwd "$cli_root/../gateways" build > "$fixture_root/gateways-build.log" 2>&1
bun run --cwd "$cli_root/../sandboxes" build > "$fixture_root/sandboxes-build.log" 2>&1
bun run --cwd "$cli_root/../registry" build > "$fixture_root/registry-build.log" 2>&1
bun run --cwd "$cli_root" build > "$fixture_root/cli-build.log" 2>&1
bun pm --cwd "$cli_root/../gateways" pack --filename "$fixture_root/gateways.tgz" > "$fixture_root/gateways-pack.log"
bun pm --cwd "$cli_root/../sandboxes" pack --filename "$fixture_root/sandboxes.tgz" > "$fixture_root/sandboxes-pack.log"
cp "$cli_root/templates/chat-app/package.json" "$fixture_root/template-package.json"
bun "$cli_root/test/serve-registry.ts" "$fixture_root/gateways.tgz" "$fixture_root/sandboxes.tgz" "$fixture_root/address" &
registry_pid=$!
for attempt in {1..100}; do
  test -s "$fixture_root/address" && break
  sleep 0.1
done
CHATJS_REGISTRY_URL="$(cat "$fixture_root/address")"
export CHATJS_REGISTRY_URL
export npm_config_user_agent="bun/$(bun --version)"

create_command=(node "$cli_root/dist/index.js" create "$fixture_root/app" --yes "${installation[@]}" --no-electron)
if [ "${CHATJS_NATIVE_DEFAULT:-0}" = 1 ]; then
  "${create_command[@]}" > "$fixture_root/create.log" 2>&1
else
  native_options=(--preset "$CHATJS_NATIVE_PRESET" "${direction[@]}" --pointer)
  if [ "${CHATJS_NATIVE_BASE_FROM_PRESET:-0}" != 1 ]; then native_options+=(--base "$CHATJS_NATIVE_BASE"); fi
  "${create_command[@]}" -- "${native_options[@]}" > "$fixture_root/create.log" 2>&1
fi
cd "$fixture_root/app"
node "$shadcn_cli" --version > "$fixture_root/shadcn-version.txt"
node "$shadcn_cli" preset resolve --json > "$fixture_root/preset.json"
bun -e '
import { strict as assert } from "node:assert";
const root = process.env.CHATJS_NATIVE_FIXTURE;
const preset = await Bun.file(`${root}/preset.json`).json();
if (process.env.CHATJS_NATIVE_DEFAULT === "1") {
  assert.equal(preset.values.style, "rhea");
} else {
  assert.equal(preset.code, process.env.CHATJS_NATIVE_EXPECTED_CODE ?? process.env.CHATJS_NATIVE_PRESET);
}
assert.deepEqual(preset.fallbacks, []);
const config = await Bun.file("components.json").json();
assert.equal(config.style, `${process.env.CHATJS_NATIVE_BASE}-${preset.values.style}`);
assert.equal(config.iconLibrary, preset.values.iconLibrary);
assert.equal(config.rtl, process.env.CHATJS_NATIVE_RTL === "1");
assert.equal(config.registries["@chatjs"], process.env.CHATJS_NATIVE_BASE === "radix" ? process.env.CHATJS_REGISTRY_URL.replace("/{name}.json", "/radix/{name}.json") : process.env.CHATJS_REGISTRY_URL);
if (process.env.CHATJS_NATIVE_SCENARIO === "uploads") {
const uploads = await Bun.file("chatjs/plugins/attachment-uploads/chatjs.json").json();
assert.equal(uploads.contractVersion, 2);
assert.equal(uploads.uiBase, process.env.CHATJS_NATIVE_BASE);
assert.equal(uploads.requiresPersistentSandbox, true);
assert.match(await Bun.file("chatjs/providers/sandbox/provider.ts").text(), /supportsPersistentSandbox = true/);
}
if (process.env.CHATJS_NATIVE_SCENARIO !== "minimal") {
for (const kind of ["text", "code", "sheet"]) {
  const descriptor = await Bun.file(`chatjs/tools/${kind}-documents/chatjs.json`).json();
  assert.equal(descriptor.contractVersion, 2);
  assert.equal(descriptor.uiBase, process.env.CHATJS_NATIVE_BASE);
}
}
if (process.env.CHATJS_NATIVE_SCENARIO === "uploads") {
assert.match(await Bun.file("chatjs/providers/storage-options.ts").text(), /chatjs-native-smoke/);
assert.match(await Bun.file("chatjs/providers/gateway.ts").text(), /openrouter/);
} else {
assert.equal(await Bun.file("chatjs/plugins/attachment-uploads/chatjs.json").exists(), false);
assert.equal(await Bun.file("chatjs/tools/text-documents/chatjs.json").exists(), process.env.CHATJS_NATIVE_SCENARIO !== "minimal");
assert.match(await Bun.file("chatjs/providers/gateway.ts").text(), /vercel|gateway/);
}
const paths = ["components.json", "app/globals.css", "app/layout.tsx", "chat.config.ts", "chatjs/providers/storage-options.ts", "lib/utils.ts", "lib/id.ts", "lib/file-language.ts", "components/ui/button.tsx"];
const before = Object.fromEntries(await Promise.all(paths.map(async path => [path, await Bun.file(path).text()])));
await Bun.write(`${root}/before.json`, JSON.stringify(before));
'
node "$shadcn_cli" add accordion --yes > "$fixture_root/shadcn-add.log" 2>&1
if [ "$CHATJS_NATIVE_SCENARIO" = uploads ]; then
  node "$cli_root/dist/index.js" add attachment-uploads --yes --cwd "$fixture_root/app" > "$fixture_root/add.log" 2>&1
fi
node "$cli_root/dist/index.js" sync --cwd "$fixture_root/app" > "$fixture_root/sync.log" 2>&1
node "$cli_root/dist/index.js" sync --cwd "$fixture_root/app" >> "$fixture_root/sync.log" 2>&1
bun -e '
import { strict as assert } from "node:assert";
const before = await Bun.file(`${process.env.CHATJS_NATIVE_FIXTURE}/before.json`).json();
for (const [path, content] of Object.entries(before)) assert.equal(await Bun.file(path).text(), content, `${path} changed during shadcn add/ChatJS add/sync`);
'
bunx tsc --noEmit > "$fixture_root/typecheck.log" 2>&1
echo "Native $CHATJS_NATIVE_SCENARIO generation, exact preset, add/sync preservation and standalone typecheck passed."
if [ "${CHATJS_NATIVE_RUNTIME:-0}" = 1 ]; then
  bun "$cli_root/test/native-runtime.ts" "$fixture_root/app"
fi
