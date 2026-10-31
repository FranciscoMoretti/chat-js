import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("loads the agent and title provider through EVE without a Next.js runtime", () => {
  // Use EVE's production loader in plain Node: tsx and Vitest module mocks
  // otherwise hide extensionless package imports and Next cache dependencies.
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
import assert from "node:assert/strict";
import { resolve } from "node:path";
const { loadAuthoredModuleNamespace } = await import(
  new URL("./internal/authored-module-loader.js", import.meta.resolve("eve"))
);
globalThis.fetch = () => { throw new Error("Unexpected network access"); };
const load = (path) => loadAuthoredModuleNamespace(resolve(path), { appRoot: process.cwd() });
const providers = await load("lib/ai/providers.ts");
const model = await providers.getLanguageModel("openai/gpt-5-nano");
assert.equal(model.modelId, "openai/gpt-5-nano");
const title = await load("plugins/ai-titles/generate-title.ts");
assert.equal(typeof title.generateEveConversationTitleResult, "function");
const agent = await load("agent/agent.ts");
assert.ok(agent.default);
`,
    ],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      encoding: "utf-8",
      env: {
        ...process.env,
        AI_GATEWAY_API_KEY: "",
        AUTH_SECRET: "model-runtime-test-secret",
        DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
        EVE_GATEWAY_SECRET: "model-runtime-test-secret-at-least-32",
        NODE_ENV: "production",
        VERCEL_OIDC_TOKEN: "",
        WORKFLOW_POSTGRES_URL: "postgres://test:test@127.0.0.1:1/test",
      },
      timeout: 20_000,
    }
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
}, 30_000);
