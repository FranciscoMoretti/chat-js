import { expect, test } from "bun:test";

import {
  baselinePath,
  demoRoot,
  generateDemo,
  syncDemo,
} from "../scripts/demo-sync";

test("demo stays aligned with full canonical installation source", async () => {
  const expected = await generateDemo();
  expect(expected.get("lib/ai/gateway-model-defaults.ts")).toContain(
    'chat: "google/gemini-2.5-flash-lite"'
  );
  expect(
    expected.get("tools/chatjs/vercel-code-execution/renderer.tsx")
  ).toContain('from "@/components/sandbox"');
  for (const id of [
    "mcp",
    "attachment-uploads",
    "vercel-analytics",
    "vercel-speed-insights",
    "langfuse",
  ]) {
    expect(expected.has(`features/${id}/chatjs.json`)).toBe(true);
    expect(expected.get("features/installed.ts")).toContain(`"${id}"`);
  }
  expect(expected.get("features/installed-uploads.ts")).toContain(
    "@/features/attachment-uploads/integration"
  );
  expect(expected.get("features/installed-layout.ts")).toContain(
    "@/features/vercel-speed-insights/component"
  );
  expect(expected.get("features/installed-instrumentation.ts")).toContain(
    "@/features/langfuse/instrumentation"
  );
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
