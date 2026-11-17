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
  selection) installation=(--installation '{"gateway":"vercel","plugins":["feedback","projects"],"eve":["connection/notion","connection/tavily","connection/firecrawl","channel/slack","tool/web_fetch","@skills/vercel-labs/agent-skills/vercel-react-best-practices"],"tools":[],"storage":{"source":"memory"},"agent":{"model":"openai/gpt-5-mini","reasoning":"high"}}') ;;
  acceptance) installation=(--installation '{"gateway":"vercel","plugins":["attachment-uploads"],"tools":["attach-workspace-file"],"storage":{"source":"minio","options":{"bucket":"chatjs-acceptance","endpoint":"http://127.0.0.1:9000"}},"agent":{"model":"openai/gpt-5-mini","defaultTools":true,"approval":"always"}}') ;;
  minimal) installation=(--gateway vercel --no-attachments) ;;
  full) installation=(--gateway vercel --no-attachments --projects --mcp) ;;
  uploads) installation=(--installation '{"gateway":"openrouter","plugins":["attachment-uploads"],"tools":["attach-workspace-file"],"sandbox":"vercel","storage":{"source":"s3","options":{"bucket":"chatjs-native-smoke"}}}') ;;
  *) echo "CHATJS_NATIVE_SCENARIO must be acceptance, selection, minimal, full or uploads" >&2; exit 1 ;;
esac
if [[ "$CHATJS_NATIVE_SCENARIO" = acceptance && "${CHATJS_NATIVE_BILLING:-0}" = 1 ]]; then
  installation=(--installation '{"gateway":"vercel","plugins":["attachment-uploads","credits"],"tools":["attach-workspace-file"],"storage":{"source":"minio","options":{"bucket":"chatjs-acceptance","endpoint":"http://127.0.0.1:9000"}},"agent":{"model":"openai/gpt-5-mini","defaultTools":true,"approval":"always"}}')
fi
cleanup() {
  kill "${registry_pid:-}" 2>/dev/null || true
  wait "${registry_pid:-}" 2>/dev/null || true
  if [ "${CHATJS_KEEP_NATIVE_FIXTURE:-0}" = 1 ]; then
    echo "Preserved native Create fixture: $fixture_root"
  else
    rm -rf "$fixture_root"
  fi
}
trap cleanup EXIT

bun run --cwd "$cli_root/../gateways" build > "$fixture_root/gateways-build.log" 2>&1
bun run --cwd "$cli_root/../registry" build > "$fixture_root/registry-build.log" 2>&1
bun run --cwd "$cli_root" build > "$fixture_root/cli-build.log" 2>&1
bun pm --cwd "$cli_root/../gateways" pack --filename "$fixture_root/gateways.tgz" > "$fixture_root/gateways-pack.log"
bun "$cli_root/test/serve-registry.ts" "$fixture_root/gateways.tgz" "$fixture_root/address" &
registry_pid=$!
for attempt in {1..100}; do
  test -s "$fixture_root/address" && break
  sleep 0.1
done
CHATJS_REGISTRY_URL="$(cat "$fixture_root/address")"
export CHATJS_REGISTRY_URL
export CHATJS_EVE_REGISTRY_URL="${CHATJS_REGISTRY_URL%/*}/eve/{name}.json"
export npm_config_user_agent="bun/$(bun --version)"

create_command=(node "$cli_root/dist/index.js" create "$fixture_root/app" --yes "${installation[@]}")
if [[ "$CHATJS_NATIVE_SCENARIO" == minimal || "$CHATJS_NATIVE_SCENARIO" == full ]]; then create_command+=(--no-electron); fi
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
if [[ "$CHATJS_NATIVE_SCENARIO" = acceptance ]]; then
  bunx --no-install eve add tool/web_fetch --skip-setup --non-interactive > "$fixture_root/eve-add.log" 2>&1
fi
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
const scenario = process.env.CHATJS_NATIVE_SCENARIO;
const attachesFiles = ["uploads", "acceptance"].includes(scenario);
// EVE writes the Slack channel file during provider setup.
assert.equal(await Bun.file("agent/channels/slack.ts").exists(), false);
assert.equal(await Bun.file("agent/connections/notion.ts").exists(), scenario === "selection");
assert.equal(await Bun.file("agent/channels/eve.ts").exists(), true);
assert.equal(await Bun.file("chatjs/plugins/attachment-uploads/chatjs.json").exists(), attachesFiles);
assert.equal(await Bun.file("chatjs/tools/attach-workspace-file/chatjs.json").exists(), attachesFiles);
if (attachesFiles) {
  const uploads = await Bun.file("chatjs/plugins/attachment-uploads/chatjs.json").json();
  assert.equal(uploads.contractVersion, 2);
  assert.equal(uploads.uiBase, process.env.CHATJS_NATIVE_BASE);
  process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
  process.env.WORKFLOW_POSTGRES_URL = process.env.DATABASE_URL;
  process.env.EVE_GATEWAY_SECRET = "fixture-eve-secret-at-least-thirty-two-characters";
  process.env.AUTH_SECRET = "fixture-auth-secret";
  process.env.APP_URL = "http://localhost:3000";
  const { installedTools } = await import("./chatjs/generated/tools.ts");
  assert.equal(typeof installedTools.attach_workspace_file.execute, "function");
  assert.equal(typeof installedTools.import_file.execute, "function");
}
if (scenario === "uploads") {
  assert.match(await Bun.file("agent/sandbox.ts").text(), /VercelSandbox/);
  assert.match(await Bun.file("chatjs/providers/storage-options.ts").text(), /chatjs-native-smoke/);
  assert.match(await Bun.file("chatjs/providers/gateway.ts").text(), /openrouter/);
} else {
  assert.match(await Bun.file("chatjs/providers/gateway.ts").text(), /vercel|gateway/);
}
if (scenario === "acceptance") {
  assert.equal(await Bun.file("agent/sandbox.ts").exists(), false);
  assert.match(await Bun.file("chatjs/providers/storage-options.ts").text(), /chatjs-acceptance/);
}
if (scenario === "selection") {
  const { readdir } = await import("node:fs/promises");
  assert.deepEqual((await readdir("chatjs/plugins")).sort(), ["feedback", "projects"]);
  assert.equal(await Bun.file("chatjs/tools/attach-workspace-file/tool.ts").exists(), false);
  const setup = await Bun.file("chatjs/eve-setup.md").text();
  assert.ok(setup.includes("eve add channel/slack --skip-install"));
  assert.ok((await Bun.file("chatjs/agent-recipe.json").json()).selection.eve.includes("channel/slack"));
  for (const provider of ["notion", "tavily", "firecrawl"]) {
    assert.ok(setup.includes(`eve add connection/${provider} --skip-install`));
  }

}
if (process.env.CHATJS_NATIVE_SCENARIO === "selection") {
  assert.match(await Bun.file("agent/agent.ts").text(), /openai\/gpt-5-mini/);
  assert.equal(await Bun.file("agent/instructions/configured.md").exists(), false);
  assert.match(await Bun.file("agent/skills/vercel-react-best-practices/SKILL.md").text(), /React/);
}
const paths = [...(scenario === "acceptance" ? ["agent/tools/web_fetch.ts"] : []), ...(attachesFiles ? ["chatjs/tools/attach-workspace-file/tool.ts"] : []), ...(scenario === "uploads" ? ["agent/sandbox.ts"] : []), "chatjs/agent-recipe.json", "agent/agent.ts", ...(process.env.CHATJS_NATIVE_SCENARIO === "selection" ? ["agent/tools/web_fetch.ts", "agent/connections/notion.ts", "agent/connections/tavily.ts", "agent/connections/firecrawl.ts", "agent/skills/vercel-react-best-practices/SKILL.md"] : []), "components.json", "app/globals.css", "app/layout.tsx", "chat.config.ts", "chatjs/providers/storage-options.ts", "lib/utils.ts", "lib/id.ts", "lib/file-language.ts", "components/ui/button.tsx"];
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
DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/fixture \
WORKFLOW_POSTGRES_URL=postgresql://fixture:fixture@127.0.0.1:1/fixture \
EVE_GATEWAY_SECRET=fixture-eve-secret-at-least-thirty-two-characters \
AUTH_SECRET=fixture-auth-secret APP_URL=http://localhost:3000 \
bunx --no-install eve info --json > "$fixture_root/eve-info.json" 2> "$fixture_root/eve-info.log"
bun -e '
import { strict as assert } from "node:assert";
const info = await Bun.file(`${process.env.CHATJS_NATIVE_FIXTURE}/eve-info.json`).json();
assert.equal(info.status, "ready");
assert.equal(info.diagnostics.errors, 0);
if (["selection", "acceptance"].includes(process.env.CHATJS_NATIVE_SCENARIO)) assert.ok(info.tools.includes("web_fetch"));
'
echo "Native $CHATJS_NATIVE_SCENARIO generation, exact preset, add/sync preservation and standalone typecheck passed."
if [ "${CHATJS_NATIVE_RUNTIME:-0}" = 1 ]; then
  bun "$cli_root/test/native-runtime.ts" "$fixture_root/app"
fi

if [ "$CHATJS_NATIVE_SCENARIO" = selection ]; then
  touch "$fixture_root/address.offline"
  node "$cli_root/dist/index.js" create "$fixture_root/replayed" --yes --recipe "$fixture_root/app/chatjs/agent-recipe.json" > "$fixture_root/replay.log" 2>&1
  cd "$fixture_root/replayed"
  bunx --no-install tsc --noEmit > "$fixture_root/replay-typecheck.log" 2>&1
  bun -e '
    import { strict as assert } from "node:assert";
    const root = process.env.CHATJS_NATIVE_FIXTURE;
    for (const file of ["agent/connections/notion.ts", "agent/agent.ts", "agent/skills/vercel-react-best-practices/SKILL.md", "agent/connections/tavily.ts", "agent/connections/firecrawl.ts", "components/ui/button.tsx"]) {
      assert.equal(await Bun.file(file).text(), await Bun.file(`${root}/app/${file}`).text(), file);
    }
    const original = await Bun.file(`${root}/app/chatjs/agent-recipe.json`).json();
    const replayed = await Bun.file("chatjs/agent-recipe.json").json();
    assert.equal(await Bun.file("agent/channels/slack.ts").exists(), false);
    assert.ok((await Bun.file("chatjs/eve-setup.md").text()).includes("eve add channel/slack --skip-install"));
    assert.deepEqual(replayed.capabilities, original.capabilities);
    assert.deepEqual(replayed.selection, original.selection);
  '
  echo "Recipe replay without registry access, frozen dependencies and standalone typecheck passed."
fi
