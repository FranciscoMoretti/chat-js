import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { expect, test } from "vitest";
import { applyWorkflowTransform } from "@eve-test/dist/src/internal/workflow-bundle/workflow-builders.js";

const require = createRequire(import.meta.url);
const entryPath = require
  .resolve("eve")
  .replace(/public\/index\.js$/u, "execution/session/entry.js");

test.each(["workflow", "metadata", "client"] satisfies (
  | "workflow"
  | "metadata"
  | "client"
)[])(
  "the installed fork preserves the runtime workflow identity in %s mode",
  async (mode) => {
    const result = await applyWorkflowTransform(
      "entry.js",
      'async function workflowEntry() { "use workflow"; return "ok"; }',
      mode,
      entryPath,
      process.cwd()
    );
    expect(
      result.workflowManifest.workflows?.["entry.js"]?.workflowEntry?.workflowId
    ).toBe("workflow//eve//workflowEntry");
  }
);

test("persisted fork workflow IDs resolve to the same callable workflow", async () => {
  const result = await applyWorkflowTransform(
    "entry.js",
    'async function workflowEntry() { "use workflow"; return "recovered"; }',
    "workflow",
    entryPath,
    process.cwd()
  );
  const workflows = new Map<string, () => Promise<string>>();
  runInNewContext(result.code, { __private_workflows: workflows });
  const current = workflows.get("workflow//eve//workflowEntry");
  const persisted = workflows.get("workflow//@chat-js/eve//workflowEntry");
  expect(persisted).toBeDefined();
  expect(persisted).toBe(current);
  await expect(persisted?.()).resolves.toBe("recovered");
});
