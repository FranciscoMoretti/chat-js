import { linkWorkspaceDependencies } from "../../test/link-workspace-dependencies";
import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scaffoldFromTemplate } from "../helpers/scaffold";
import { toolDefinitionSchema } from "../../../registry/metadata";
import { planToolConfig } from "./tool-config";
import { run } from "../../test/run-command";

const roots: string[] = [];
const demo = path.resolve(import.meta.dir, "../../../../apps/chat");
const definition = toolDefinitionSchema.parse({
  contractVersion: 1,
  id: "custom-research",
  kind: "tool",
  config: { key: "research" },
  tools: [{ toolExport: "customResearch" }],
});
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots.splice(0).map(async (root): Promise<void> => {
      await rm(root, { recursive: true, force: true });
    })
  );
});
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-tool-config-"));
  roots.push(root);
  return root;
};

test("configuration only accepts installed tools, with typed partial overrides and extension defaults", async (): Promise<void> => {
  const root = await fixture();
  await scaffoldFromTemplate(root);
  await cp(
    path.join(demo, "lib/ai/gateway.ts"),
    path.join(root, "lib/ai/gateway.ts")
  );
  await linkWorkspaceDependencies(demo, root);
  await writeFile(
    path.join(root, "chat.config.ts"),
    'import { defineConfig } from "./lib/config-schema"; export default defineConfig({ appName: "Test", appPrefix: "test" });'
  );
  await writeFile(
    path.join(root, "probe.ts"),
    `
import { defineConfig, applyDefaults } from "./lib/config-schema";
import { gatewayType } from "./lib/ai/gateway-model-defaults";
import assert from "node:assert/strict";
const input = defineConfig({ ai: { gateway: gatewayType, tools: { followupSuggestions: { enabled: true } } } });
assert.deepEqual(Object.keys(applyDefaults(input).ai.tools), ["followupSuggestions"]);
// @ts-expect-error An uninstalled option is rejected even alongside a valid core key.
defineConfig({ ai: { gateway: gatewayType, tools: { followupSuggestions: {}, research: {} } } });
`
  );
  await writeFile(
    path.join(root, "probe-env.d.ts"),
    '/// <reference types="next" />\n'
  );
  await writeFile(
    path.join(root, "tsconfig.probe.json"),
    JSON.stringify({
      extends: "./tsconfig.json",
      include: ["probe.ts", "probe-env.d.ts"],
      exclude: ["node_modules"],
      compilerOptions: { incremental: false },
    })
  );
  await run(root, [
    "bunx",
    "--no-install",
    "tsc",
    "--noEmit",
    "-p",
    "tsconfig.probe.json",
  ]);
  await run(root, ["bun", "probe.ts"]);
  await mkdir(path.join(root, "tools/chatjs/custom-research"), {
    recursive: true,
  });
  await cp(
    path.join(demo, "tools/chatjs/deep-research/configuration-schema.ts"),
    path.join(root, "tools/chatjs/custom-research/configuration-schema.ts")
  );
  await writeFile(
    path.join(root, "chatjs/generated/installed-config.ts"),
    await planToolConfig(root, [definition])
  );
  await writeFile(
    path.join(root, "probe.ts"),
    `
import { defineConfig, applyDefaults, aiConfigSchema } from "./lib/config-schema";
import { gatewayType, gatewayModelDefaults } from "./lib/ai/gateway-model-defaults";
import assert from "node:assert/strict";
const input = defineConfig({ ai: { gateway: gatewayType, tools: { research: { allowClarification: false } } } });
const parsed = applyDefaults(input);
assert.equal(parsed.ai.tools.research.allowClarification, false);
assert.equal(parsed.ai.tools.research.finalReportModel, gatewayModelDefaults.roles.smart);
assert.equal(aiConfigSchema.safeParse({ ...parsed.ai, tools: { ...parsed.ai.tools, uninstalled: {} } }).success, false);
// @ts-expect-error Unknown options are rejected alongside installed options.
defineConfig({ ai: { gateway: gatewayType, tools: { research: {}, uninstalled: {} } } });
`
  );
  await run(root, [
    "bunx",
    "--no-install",
    "tsc",
    "--noEmit",
    "-p",
    "tsconfig.probe.json",
  ]);
  await run(root, ["bun", "probe.ts"]);
}, 60_000);

test("configuration contributions cannot overwrite each other or core keys", async (): Promise<void> => {
  const root = await fixture();
  await rejects(
    planToolConfig(root, [definition, { ...definition, id: "another" }]),
    /Duplicate/u
  );
  await rejects(
    planToolConfig(root, [
      { ...definition, config: { key: "followupSuggestions" } },
    ]),
    /reserved/u
  );
  await rejects(planToolConfig(root, [definition]), /ENOENT/u);
  expect(
    await readFile(path.join(demo, "lib/config-schema.ts"), "utf-8")
  ).not.toContain("deepResearch");
});
