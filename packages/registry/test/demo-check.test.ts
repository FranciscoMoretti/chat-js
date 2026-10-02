import { expect, test } from "bun:test";

import {
  baselinePath,
  demoRoot,
  generateDemo,
  syncDemo,
} from "../scripts/demo-sync";

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
  expect(
    required("tools/chatjs/vercel-code-execution/renderer.tsx")
  ).toContain('from "@/components/sandbox"');
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
