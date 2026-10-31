import { expect, it } from "bun:test";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { builtInGateways } from "../../../registry/src/gateways/catalog";
import { configureGatewayProvider } from "./gateway-provider";
import pathModule from "node:path";
import { scaffoldFromTemplate } from "./scaffold";
import { tmpdir } from "node:os";

const firstIndex = 0;

it("wires selected defaults and snapshot identity without managing dependencies", async () => {
  const cwd = await mkdtemp(pathModule.join(tmpdir(), "chatjs-wiring-"));
  try {
    await scaffoldFromTemplate(cwd);
    await rm(pathModule.join(cwd, "lib/ai/models.generated.ts"));
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
      const [generatedDefaults, generatedSnapshot, currentManifest] =
        // oxlint-disable-next-line no-await-in-loop -- Finish reading this gateway's three outputs before the next configureGatewayProvider call overwrites them.
        await Promise.all([
          readFile(
            pathModule.join(cwd, "chatjs/providers/gateway-defaults.ts"),
            "utf-8"
          ),
          readFile(pathModule.join(cwd, "lib/ai/models.generated.ts"), "utf-8"),
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
      expect(generatedSnapshot).toContain(
        `generatedForGateway = "${item.meta.chatjs.id}"`
      );
      expect(currentManifest).toBe(manifest);
    }
    const target = pathModule.join(cwd, "chatjs/providers/gateway-defaults.ts");
    const snapshot = await readFile(
      pathModule.join(cwd, "lib/ai/models.generated.ts"),
      "utf-8"
    );
    await rm(target);
    await symlink(pathModule.join(cwd, "package.json"), target);
    expect(
      configureGatewayProvider(cwd, {
        definition: builtInGateways[firstIndex].meta.chatjs,
        source: "vercel",
      })
    ).rejects.toThrow("symlink");
    expect(await readFile(pathModule.join(cwd, "package.json"), "utf-8")).toBe(
      manifest
    );
    expect(
      await readFile(
        pathModule.join(cwd, "lib/ai/models.generated.ts"),
        "utf-8"
      )
    ).toBe(snapshot);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
