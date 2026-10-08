import { afterEach, expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */

// oxlint-disable-next-line sort-imports -- Preserve node:os before ../../../registry/src/gateways/catalog while their runtime initialization order is still under site review.
import { builtInGateways } from "../../../registry/src/gateways/catalog";

/* oxlint-enable import/no-relative-parent-imports */

// oxlint-disable-next-line sort-imports -- Preserve ../../../registry/src/gateways/catalog before ./provider-config while their runtime initialization order is still under site review.
import { gatewayConfigEdit, readProviderId } from "./provider-config";

const roots: string[] = [];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterEach's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map(async (root) => await rm(root, { force: true, recursive: true }))
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-magic-numbers */
test("provider replacement recognizes literal wrappers and refuses unknown installed IDs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-provider-"));
  roots.push(root);
  await mkdir(path.join(root, "lib/ai"), { recursive: true });
  const file = path.join(root, "lib/ai/gateway-model-defaults.ts");
  await writeFile(
    file,
    'export const gatewayType = ("openai" as const) satisfies string;'
  );
  expect(await readProviderId(root, "gateway")).toBe("openai");
  await writeFile(file, "export const gatewayType = `openai`;");
  expect(await readProviderId(root, "gateway")).toBe("openai");
  await writeFile(file, "export const gatewayType = process.env.GATEWAY;");
  expect(readProviderId(root, "gateway")).rejects.toThrow("Cannot determine");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
test("gateway replacement edits only the active root config discriminator", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-provider-config-"));
  roots.push(root);
  const original =
    'const unrelated = { ai: { gateway: "other" } };\nconst config = defineConfig({ ai: { gateway: "openai", models: { chat: "chosen" } }, extra: { ai: { gateway: "nested" } } });\nexport default config;\n';
  await writeFile(path.join(root, "chat.config.ts"), original);
  const item = builtInGateways.find(
    (gateway: {
      readonly meta: { readonly chatjs: { readonly id: string } };
    }) => gateway.meta.chatjs.id === "vercel"
  );
  if (!item) {
    throw new Error("Missing Vercel fixture");
  }
  const selection = { definition: item.meta.chatjs, source: "vercel" };
  expect(await gatewayConfigEdit(root, selection)).toBe(
    original.replace('gateway: "openai"', 'gateway: "vercel"')
  );
  expect(await readFile(path.join(root, "chat.config.ts"), "utf-8")).toBe(
    original
  );
  const bound = original
    .replace("const config = defineConfig({", "const configInput = {")
    .replace(
      "} });\nexport default config;",
      "} };\nexport default defineConfig(configInput);"
    );
  await writeFile(path.join(root, "chat.config.ts"), bound);
  expect(await gatewayConfigEdit(root, selection)).toBe(
    bound.replace('gateway: "openai"', 'gateway: "vercel"')
  );
  const awaitUsing = bound.replace(
    "const configInput",
    "await using configInput"
  );
  await writeFile(path.join(root, "chat.config.ts"), awaitUsing);
  expect(await gatewayConfigEdit(root, selection)).toBe(
    awaitUsing.replace('gateway: "openai"', 'gateway: "vercel"')
  );
  await writeFile(
    path.join(root, "chat.config.ts"),
    bound.replace("defineConfig(", "transformConfig(")
  );
  expect(gatewayConfigEdit(root, selection)).rejects.toThrow(
    "literal ai.gateway"
  );
  const mutable = bound
    .replace("const configInput", "let configInput")
    .replace(
      "export default",
      'configInput = { ai: { gateway: "vercel" } };\nexport default'
    );
  await writeFile(path.join(root, "chat.config.ts"), mutable);
  expect(gatewayConfigEdit(root, selection)).rejects.toThrow(
    "literal ai.gateway"
  );
  expect(await readFile(path.join(root, "chat.config.ts"), "utf-8")).toBe(
    mutable
  );
  const modified = bound.replace(
    "export default",
    'configInput.ai = { gateway: "openai", models: { chat: "other" } };\nexport default'
  );
  await writeFile(path.join(root, "chat.config.ts"), modified);
  expect(gatewayConfigEdit(root, selection)).rejects.toThrow(
    "literal ai.gateway"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   ['{ ai: { gateway: "openai", ...loadAiSettings() } }', false],   ['{ ai: { gateway: "o's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
test.each([
  ['{ ai: { gateway: "openai", ...loadAiSettings() } }', false],
  ['{ ai: { gateway: "openai" }, ...loadConfig() }', false],
  ['{ ai: { gateway: "openai", [settingKey]: "other" } }', false],
  ['{ ai: { gateway: "openai" }, [sectionKey]: {} }', false],
  ['{ ai: { gateway: "openai", get gateway() { return "other"; } } }', false],
  ['{ ...loadConfig(), ai: { ...loadAiSettings(), gateway: "openai" } }', true],
  ['{ ai: { gateway: "inactive" }, ai: { gateway: "openai" } }', true],
  ['{ ai: { gateway: "inactive", gateway: "openai" } }', true],
])(
  "gateway replacement respects property order in %s",
  async (config, safe) => {
    const root = await mkdtemp(path.join(tmpdir(), "chatjs-provider-spreads-"));
    roots.push(root);
    const file = path.join(root, "chat.config.ts");
    const item = builtInGateways.find(
      (gateway: {
        readonly meta: { readonly chatjs: { readonly id: string } };
      }) => gateway.meta.chatjs.id === "vercel"
    );
    if (!item) {
      throw new Error("Missing Vercel fixture");
    }
    const selection = { definition: item.meta.chatjs, source: "vercel" };
    const original = `export default defineConfig(${config});\n`;
    await writeFile(file, original);
    if (safe) {
      expect(await gatewayConfigEdit(root, selection)).toBe(
        original.replace('gateway: "openai"', 'gateway: "vercel"')
      );
    } else {
      expect(gatewayConfigEdit(root, selection)).rejects.toThrow(
        "literal ai.gateway"
      );
    }
    expect(await readFile(file, "utf-8")).toBe(original);
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
