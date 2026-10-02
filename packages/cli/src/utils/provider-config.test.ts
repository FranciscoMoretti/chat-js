import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { builtInGateways } from "../../../registry/src/gateways/catalog";
import { gatewayConfigEdit, readProviderId } from "./provider-config";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true }))
  );
});
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
  await expect(readProviderId(root, "gateway")).rejects.toThrow(
    "Cannot determine"
  );
});
test("gateway replacement edits only the active root config discriminator", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-provider-config-"));
  roots.push(root);
  const original =
    'const unrelated = { ai: { gateway: "other" } };\nconst config = defineConfig({ ai: { gateway: "openai", models: { chat: "chosen" } }, extra: { ai: { gateway: "nested" } } });\nexport default config;\n';
  await writeFile(path.join(root, "chat.config.ts"), original);
  const item = builtInGateways.find(
    (gateway) => gateway.meta.chatjs.id === "vercel"
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
  await writeFile(
    path.join(root, "chat.config.ts"),
    bound.replace("defineConfig(", "transformConfig(")
  );
  await expect(gatewayConfigEdit(root, selection)).rejects.toThrow(
    "literal ai.gateway"
  );
  const mutable = bound
    .replace("const configInput", "let configInput")
    .replace(
      "export default",
      'configInput = { ai: { gateway: "vercel" } };\nexport default'
    );
  await writeFile(path.join(root, "chat.config.ts"), mutable);
  await expect(gatewayConfigEdit(root, selection)).rejects.toThrow(
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
  await expect(gatewayConfigEdit(root, selection)).rejects.toThrow(
    "literal ai.gateway"
  );
});
