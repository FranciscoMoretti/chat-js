import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it.each(["production", "development"])(
  "loads the agent and title provider through EVE in %s",
  (mode) => {
    // Use EVE's production loader in plain Node: tsx and Vitest module mocks
    // otherwise hide extensionless package imports and Next cache dependencies.
    const result = spawnSync(
      process.execPath,
      [
        `--conditions=${mode}`,
        "--input-type=module",
        "--eval",
        `
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
const { loadAuthoredModuleNamespace } = await import(
  new URL("./internal/authored-module-loader.js", import.meta.resolve("eve"))
);
globalThis.fetch = () => { throw new Error("Unexpected network access"); };
const appRoot = process.cwd();
const load = (path) => loadAuthoredModuleNamespace(resolve(appRoot, path), { appRoot });
const scratch = mkdtempSync(resolve(tmpdir(), "chatjs-model-runtime-"));
process.chdir(scratch);
try {
  const providers = await load("lib/ai/providers.ts");
  const model = await providers.getLanguageModel("openai/gpt-5-nano");
  assert.equal(model.modelId, "openai/gpt-5-nano");
  await assert.rejects(() => model.doGenerate({ prompt: [] }));
  const recording = ".devtools/generations.json";
  if (process.env.NODE_ENV === "development") {
    const { steps } = JSON.parse(readFileSync(recording, "utf8"));
    assert.equal(steps[0].model_id, model.modelId);
  } else {
    assert.equal(existsSync(recording), false);
  }
  const title = await load("chatjs/plugins/ai-titles/generate-title.ts");
  assert.equal(typeof title.generateEveConversationTitleResult, "function");
  const agent = await load("agent/agent.ts");
  assert.ok(agent.default);
} finally {
  process.chdir(appRoot);
  rmSync(scratch, { recursive: true, force: true });
}
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
          NODE_ENV: mode,
          VERCEL_OIDC_TOKEN: "",
          WORKFLOW_POSTGRES_URL: "postgres://test:test@127.0.0.1:1/test",
        },
        timeout: 20_000,
      }
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  },
  30_000
);
