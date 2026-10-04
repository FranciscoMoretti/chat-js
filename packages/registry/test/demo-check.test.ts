import { expect, test } from "bun:test";

/* oxlint-disable import/no-relative-parent-imports -- Import the package-local generated catalog, schema, or demo installer directly; application aliases do not identify these registry package modules. */
import {
  baselinePath,
  demoRoot,
  generateDemo,
  syncDemo,
} from "../scripts/demo-sync";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable eslint/max-statements -- Keep setup, side effects, and assertions for demo stays aligned with full canonical installation source together so the transaction and cleanup remain visible in one test. */
/* oxlint-disable eslint/max-lines-per-function -- Keep setup, side effects, and assertions for demo stays aligned with full canonical installation source together so the transaction and cleanup remain visible in one test. */
/* oxlint-disable eslint/no-magic-numbers -- The 60-second timeout accommodates the full canonical demo generation and source comparison. */
test("demo stays aligned with full canonical installation source", async () => {
  const expected = await generateDemo();
  const required = (file: string): string => {
    const source = expected.get(file);
    if (typeof source !== "string") {
      throw new TypeError(`Missing canonical demo file: ${file}`);
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
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
