// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";

import { run } from "./run-command";

const definition = {
  contractVersion: 1,
  id: "paid-counter",
  kind: "tool",
  tools: [
    {
      rendererExport: "PaidCounterRenderer",
      toolExport: "externalPaidCounter",
    },
  ],
};

const nativeToolFixture = {
  dependencies: ["zod"],
  files: [
    {
      content: JSON.stringify(definition),
      path: "chatjs.json",
      target: "~/tools/chatjs/paid-counter/chatjs.json",
      type: "registry:file",
    },
    {
      content: `import { defineTool } from "eve/tools";
import { toolResultToModelOutput } from "@/lib/eve/tool-model-output";
import { z } from "zod";
import { executeWithToolUsage } from "@/lib/eve/tool-usage";
export const externalPaidCounter = defineTool({
  description: "Deterministic paid tool installation fixture",
  inputSchema: z.object({ fail: z.boolean(), crash: z.boolean().optional() }),
  execute: ({ fail, crash }, context) => executeWithToolUsage(context, (usage) => {
    usage.addCostUsd(0.02);
    if (crash) throw new Error("Unexpected fixture failure");
    if (fail) usage.fail();
    return { answer: 42 };
  }),
  toModelOutput: toolResultToModelOutput,
});`,
      path: "tool.ts",
      target: "~/tools/chatjs/paid-counter/tool.ts",
      type: "registry:file",
    },
    {
      content: `"use client";
import { z } from "zod";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
export const PaidCounterRenderer = defineToolRenderer({
  inputSchema: z.object({ fail: z.boolean() }),
  outputSchema: z.object({ answer: z.number() }),
  render: ({ tool }) => <p>{tool.state === "output-available" ? tool.output.answer : "Working"}</p>,
});`,
      path: "renderer.tsx",
      target: "~/tools/chatjs/paid-counter/renderer.tsx",
      type: "registry:file",
    },
  ],
  meta: { chatjs: definition },
  name: "paid-counter",
  type: "registry:item",
};

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/** Run the installed app's registration through a real, isolated EVE worker. */
const verifyNativeToolRuntime = async (cwd: string) => {
  const fixture = path.join(cwd, "native-runtime");
  await mkdir(path.join(fixture, "agent/tools"), { recursive: true });
  await mkdir(path.join(fixture, "evals"), { recursive: true });
  await Promise.all([
    writeFile(
      path.join(fixture, "agent/instructions.md"),
      "Execute the requested tool once and report its result.\n"
    ),
    // This fixture never creates sandboxes. Keep EVE's dev cleanup independent
    // of a developer's potentially stopped Docker daemon.
    writeFile(
      path.join(fixture, "environment.mjs"),
      'process.env.DOCKER_HOST = "unix:///tmp/chatjs-native-test-no-docker.sock";\nprocess.env.NODE_ENV = "development";\nprocess.env.PLAYWRIGHT = "True";\nprocess.env.EVE_MOCK_AUTHORED_MODELS = "0";\n'
    ),
    writeFile(
      path.join(fixture, "package.json"),
      JSON.stringify({
        dependencies: { eve: "npm:@chat-js/eve@0.61.0-chatjs.0" },
        private: true,
        type: "module",
      })
    ),
    writeFile(
      path.join(fixture, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { paths: { "@/*": ["../*"] } },
        extends: "../tsconfig.json",
      })
    ),
    writeFile(
      path.join(fixture, "agent/tools/installed.ts"),
      'export { default } from "../../../agent/tools/installed";\n'
    ),
    writeFile(
      path.join(fixture, "agent/agent.ts"),
      `import { defineAgent } from "eve";
import { mockModel } from "eve/evals";
export default defineAgent({
  defaultTools: false,
  model: mockModel(({ lastUserMessage, toolResults }) => toolResults.length ? "Done" : ({ toolCalls: [{ name: lastUserMessage === "words" ? "wordCount" : "externalPaidCounter", input: lastUserMessage === "words" ? { text: "one two" } : { fail: lastUserMessage === "failure", crash: lastUserMessage === "exception" } }] })),
  modelContextWindowTokens: 128000,
});`
    ),
    writeFile(
      path.join(fixture, "evals/evals.config.ts"),
      'import { defineEvalConfig } from "eve/evals";\nexport default defineEvalConfig({ maxConcurrency: 1 });\n'
    ),
    writeFile(
      path.join(fixture, "evals/installed.eval.ts"),
      `import assert from "node:assert/strict";
import { defineEval } from "eve/evals";
import { Client } from "eve/client";
export default ["words", "success", "failure", "exception"].map((scenario) => defineEval({
  description: scenario,
  async test(t) {
    const turn = await t.send(scenario);
    turn.succeeded();
    if (!turn.toolCalls.length) t.log(JSON.stringify(turn.events));
    const name = scenario === "words" ? "wordCount" : "externalPaidCounter";
    const client = new Client({ host: t.target.url });
    const snapshot = await client.sessions.attach(turn.sessionId).snapshot();
    const result = snapshot.events.find((event) => event.type === "action.result" && event.data.result.kind === "tool-result" && event.data.result.toolName === name);
    if (scenario === "exception") {
      assert.equal(result?.data.status, "failed");
      return;
    }
    assert.equal(result?.data.status, "completed");
    const receipt = turn.requireToolCall(name).output;
    assert.equal(receipt.usage.costUsd, scenario === "words" ? 0 : 0.02);
    assert.equal(receipt.error, scenario === "failure" ? "The tool did not complete." : undefined);
    assert.deepEqual(receipt.output, scenario === "failure" ? null : scenario === "words" ? { characters: 7, charactersNoSpaces: 6, sentences: 1, words: 2 } : { answer: 42 });
    assert.deepEqual(result?.data.result.output, receipt);
  },
}));`
    ),
  ]);
  await run(
    fixture,
    [
      "node",
      "--import",
      "./environment.mjs",
      "../node_modules/eve/bin/eve.js",
      "eval",
      "--strict",
      "--verbose",
      "--timeout",
      "60000",
    ],
    180_000
  );
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
export { nativeToolFixture, verifyNativeToolRuntime };
