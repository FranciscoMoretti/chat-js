import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { applyWorkflowTransform } from "@eve-test/dist/src/internal/workflow-bundle/workflow-builders.js";

const entryPath = fileURLToPath(
  new URL(
    "../node_modules/eve/dist/src/execution/session/entry.js",
    import.meta.url
  )
);

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
