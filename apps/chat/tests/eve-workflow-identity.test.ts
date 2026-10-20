import { createRequire } from "node:module";
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
