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
