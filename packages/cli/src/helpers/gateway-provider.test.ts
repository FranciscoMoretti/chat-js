import { expect, it } from "bun:test";
import { mkdtemp, rm, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import { builtInGateways } from "../../../registry/src/gateways/catalog";
import { configureGatewayProvider } from "./gateway-provider";
import { scaffoldFromTemplate } from "./scaffold";

const { join } = pathModule;

it("wires selected defaults and snapshot identity without managing dependencies", async () => {
  const cwd = await mkdtemp(pathModule.join(tmpdir(), "chatjs-wiring-"));
  try {
    await scaffoldFromTemplate(cwd);
    await rm(join(cwd, "lib/ai/models.generated.ts"));
    const manifest = await readFile(join(cwd, "package.json"), "utf-8");
    for (const item of builtInGateways) {
      await configureGatewayProvider(cwd, {
        definition: item.meta.chatjs,
        source: item.name,
      });
      const generatedDefaults = await readFile(
        join(cwd, "lib/ai/gateway-model-defaults.ts"),
        "utf-8"
      );
      expect(generatedDefaults).toContain(
        `gatewayType = "${item.meta.chatjs.id}"`
      );
      const codeIndex = generatedDefaults.indexOf('"code": {');
      const deepResearchIndex = generatedDefaults.indexOf('"deepResearch": {');
      const allowClarificationIndex = generatedDefaults.indexOf(
        '"allowClarification":'
      );
      const defaultModelIndex = generatedDefaults.indexOf('"defaultModel":');
      expect(codeIndex).toBeGreaterThanOrEqual(0);
      expect(deepResearchIndex).toBeGreaterThan(codeIndex);
      expect(allowClarificationIndex).toBeGreaterThanOrEqual(0);
      expect(defaultModelIndex).toBeGreaterThan(allowClarificationIndex);
      expect(
        await readFile(join(cwd, "lib/ai/models.generated.ts"), "utf-8")
      ).toContain(`generatedForGateway = "${item.meta.chatjs.id}"`);
      expect(await readFile(join(cwd, "package.json"), "utf-8")).toBe(manifest);
    }
    const target = join(cwd, "lib/ai/gateway-model-defaults.ts");
    const snapshot = await readFile(
      join(cwd, "lib/ai/models.generated.ts"),
      "utf-8"
    );
    await rm(target);
    await symlink(join(cwd, "package.json"), target);
    await expect(
      configureGatewayProvider(cwd, {
        definition: builtInGateways[0].meta.chatjs,
        source: "vercel",
      })
    ).rejects.toThrow("symlink");
    expect(await readFile(join(cwd, "package.json"), "utf-8")).toBe(manifest);
    expect(
      await readFile(join(cwd, "lib/ai/models.generated.ts"), "utf-8")
    ).toBe(snapshot);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
