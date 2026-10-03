import { expect, test } from "bun:test";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  baselinePath,
  demoRoot,
  generateDemo,
  syncDemo,
} from "../scripts/demo-sync";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
test("demo stays aligned with full canonical installation source", async () => {
  const expected = await generateDemo();
  const required = (file: string) => {
    const source = expected.get(file);
    if (source === undefined) {
      throw new Error(`Missing canonical demo file: ${file}`);
    }
    return source;
  };
  expect(required("lib/ai/gateway-model-defaults.ts")).toContain(
    'chat: "google/gemini-2.5-flash-lite"'
  );
  expect(required("tools/chatjs/vercel-code-execution/renderer.tsx")).toContain(
    'from "@/components/sandbox"'
  );
  for (const id of [
    "mcp",
    "attachment-uploads",
    "vercel-analytics",
    "vercel-speed-insights",
    "langfuse",
  ]) {
    expect(expected.has(`features/${id}/chatjs.json`)).toBe(true);
    expect(required("features/installed.ts")).toContain(`"${id}"`);
  }
  expect(required("features/installed-uploads.ts")).toContain(
    "@/features/attachment-uploads/integration"
  );
  expect(required("features/installed-layout.ts")).toContain(
    "@/features/vercel-speed-insights/component"
  );
  expect(required("features/installed-instrumentation.ts")).toContain(
    "@/features/langfuse/instrumentation"
  );
  for (const file of [
    "features/mcp/setup.ts",
    "tools/chatjs/retrieve-url/tool.ts",
    "tools/chatjs/tavily-search/tool.ts",
    "lib/db/mcp-oauth-lock.ts",
    "tools/chatjs/vercel-code-execution/execution-sandbox.ts",
  ]) {
    expect(required(file)).toContain('from "@/lib/env"');
    expect(required(file)).not.toContain("@/features/langfuse/");
  }
  expect(expected.has("composer-controls.ts")).toBe(false);
  expect(expected.has("settings-items.ts")).toBe(false);
  expect(expected.has("tools/chatjs/custom-tools.ts")).toBe(false);
  expect(expected.has("tools/chatjs/custom-ui.ts")).toBe(false);
  await syncDemo({
    baseline: baselinePath,
    check: true,
    expected,
    root: demoRoot,
  });
}, 60_000);
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
