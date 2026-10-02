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
  expect(required("tools/chatjs/vercel-code-execution/renderer.tsx")).toContain(
    'from "@/components/sandbox"'
  );
  expect(expected.has("composer-controls.ts")).toBe(false);
  expect(expected.has("settings-items.ts")).toBe(false);
  expect(expected.has("tools/chatjs/custom-tools.ts")).toBe(false);
  expect(expected.has("tools/chatjs/custom-ui.ts")).toBe(false);
  // Same-basename shadcn rewriting must not replace core env imports with
  // optional feature modules when the full demo installs Langfuse.
  for (const file of [
    "features/mcp/setup.ts",
    "lib/db/mcp-oauth-lock.ts",
    "tools/chatjs/retrieve-url/tool.ts",
    "tools/chatjs/tavily-search/tool.ts",
    "tools/chatjs/vercel-code-execution/sandbox.ts",
  ]) {
    expect(required(file)).toContain('from "@/lib/env"');
  }
  await syncDemo({
    baseline: baselinePath,
    check: true,
    expected,
    root: demoRoot,
  });
}, 60_000);
