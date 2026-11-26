import { rejects } from "node:assert/strict";
import { expect, it } from "bun:test";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { builtInGateways } from "../../../registry/src/gateways/catalog";
import { configureGatewayProvider } from "./gateway-provider";
import pathModule from "node:path";
import { scaffoldFromTemplate } from "./scaffold";
import { tmpdir } from "node:os";

const firstIndex = 0;

it("wires selected defaults without managing dependencies", async () => {
  const cwd = await mkdtemp(pathModule.join(tmpdir(), "chatjs-wiring-"));
  try {
    await scaffoldFromTemplate(cwd);
    const manifest = await readFile(
      pathModule.join(cwd, "package.json"),
      "utf-8"
    );
    for (const item of builtInGateways) {
      // oxlint-disable-next-line no-await-in-loop -- Exercise successive gateway switches in the same generated application.
      await configureGatewayProvider(cwd, {
        definition: item.meta.chatjs,
        source: item.name,
      });
      const [generatedDefaults, currentManifest] =
        // oxlint-disable-next-line no-await-in-loop -- Finish reading these files before the next configureGatewayProvider call overwrites them.
        await Promise.all([
          readFile(
            pathModule.join(cwd, "chatjs/providers/gateway-defaults.ts"),
            "utf-8"
          ),
          readFile(pathModule.join(cwd, "package.json"), "utf-8"),
        ]);
      expect(generatedDefaults).toContain(
        `gatewayType = "${item.meta.chatjs.id}"`
      );
      expect(generatedDefaults).toContain('"roles": {');
      expect(generatedDefaults).toContain('"smart":');
      expect(generatedDefaults).toContain('"balanced":');
      expect(generatedDefaults).toContain('"fast":');
      expect(generatedDefaults).not.toContain('"deepResearch":');
      expect(currentManifest).toBe(manifest);
    }
    const target = pathModule.join(cwd, "chatjs/providers/gateway-defaults.ts");
    await rm(target);
    await symlink(pathModule.join(cwd, "package.json"), target);
    await rejects(
      configureGatewayProvider(cwd, {
        definition: builtInGateways[firstIndex].meta.chatjs,
        source: "vercel",
      }),
      /symlink/u
    );
    expect(await readFile(pathModule.join(cwd, "package.json"), "utf-8")).toBe(
      manifest
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
