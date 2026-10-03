import { expect, it } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdtemp, rm, readFile, symlink } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import pathModule from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { builtInGateways } from "../../../registry/src/gateways/catalog";
/* oxlint-enable import/no-relative-parent-imports */
import { configureGatewayProvider } from "./gateway-provider";
import { scaffoldFromTemplate } from "./scaffold";

// oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
const { join } = pathModule;

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
it("wires selected defaults and snapshot identity without managing dependencies", async () => {
  const cwd = await mkdtemp(pathModule.join(tmpdir(), "chatjs-wiring-"));
  try {
    await scaffoldFromTemplate(cwd);
    await rm(join(cwd, "lib/ai/models.generated.ts"));
    const manifest = await readFile(join(cwd, "package.json"), "utf-8");
    for (const item of builtInGateways) {
      // oxlint-disable-next-line no-await-in-loop -- Exercise successive gateway switches in the same generated application.
      await configureGatewayProvider(cwd, {
        definition: item.meta.chatjs,
        source: item.name,
      });
      // oxlint-disable-next-line no-await-in-loop -- Verify each gateway before the next switch overwrites the same files.
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
        // oxlint-disable-next-line no-await-in-loop -- Read the snapshot for this switch before the next mutation.
        await readFile(join(cwd, "lib/ai/models.generated.ts"), "utf-8")
      ).toContain(`generatedForGateway = "${item.meta.chatjs.id}"`);
      // oxlint-disable-next-line no-await-in-loop -- Assert the manifest after each sequential switch.
      expect(await readFile(join(cwd, "package.json"), "utf-8")).toBe(manifest);
    }
    const target = join(cwd, "lib/ai/gateway-model-defaults.ts");
    const snapshot = await readFile(
      join(cwd, "lib/ai/models.generated.ts"),
      "utf-8"
    );
    await rm(target);
    await symlink(join(cwd, "package.json"), target);
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
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
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
