import {
  baselinePath,
  demoRoot,
  generateDemo,
  syncDemo,
} from "../scripts/demo-sync";
import { expect, test } from "bun:test";

const GENERATION_TIMEOUT_MS = 60_000;

const required = (
  expected: Readonly<Record<string, string>>,
  file: string
): string => {
  const source = expected[file];
  if (typeof source !== "string") {
    throw new TypeError(`Missing canonical demo file: ${file}`);
  }
  return source;
};

const verifyGatewayAndTool = (
  expected: Readonly<Record<string, string>>
): void => {
  expect(required(expected, "lib/ai/gateway-model-defaults.ts")).toContain(
    'chat: "google/gemini-2.5-flash-lite"'
  );
  expect(
    required(expected, "tools/chatjs/code-execution/renderer.tsx")
  ).toContain('from "@/components/sandbox.tsx"');
};

const verifyFeatures = (expected: Readonly<Record<string, string>>): void => {
  for (const id of [
    "mcp",
    "attachment-uploads",
    "vercel-analytics",
    "vercel-speed-insights",
    "langfuse",
  ]) {
    expect(Object.hasOwn(expected, `features/${id}/chatjs.json`)).toBe(true);
    expect(required(expected, "features/installed.ts")).toContain(`"${id}"`);
  }
  expect(required(expected, "features/installed-uploads.ts")).toContain(
    "@/features/attachment-uploads/integration"
  );
  expect(required(expected, "features/installed-layout.ts")).toContain(
    "@/features/vercel-speed-insights/component"
  );
  expect(required(expected, "features/installed-instrumentation.ts")).toContain(
    "@/features/langfuse/instrumentation"
  );
};

const verifyEnvironmentBoundaries = (
  expected: Readonly<Record<string, string>>
): void => {
  for (const [file, reader] of [
    ["features/mcp/setup.ts", "./mcp-env"],
    ["tools/chatjs/retrieve-url/tool.ts", "./retrieve-url-env"],
    ["tools/chatjs/tavily-search/tool.ts", "./tavily-search-env"],
    ["lib/sandbox/adapter.ts", "./vercel-sandbox-env"],
  ] as const) {
    expect(required(expected, file)).toContain(`from "${reader}"`);
    expect(required(expected, file)).not.toContain('from "@/lib/env"');
    expect(required(expected, file)).not.toContain("@/features/langfuse/");
  }
  // Database credentials still belong to core, even for an installable query.
  expect(required(expected, "lib/db/mcp-oauth-lock.ts")).toContain(
    'from "@/lib/env"'
  );
};

const verifyExcludedFiles = (
  expected: Readonly<Record<string, string>>
): void => {
  for (const file of [
    "test-json.ts",
    "demo-sync-test-support.ts",
    "features/test-runtime.ts",
    "composer-controls.ts",
    "settings-items.ts",
    "tools/chatjs/custom-tools.ts",
    "tools/chatjs/custom-ui.ts",
  ]) {
    expect(Object.hasOwn(expected, file)).toBe(false);
  }
};

test(
  "demo stays aligned with full canonical installation source",
  async () => {
    const expected = await generateDemo();
    const source = Object.fromEntries(expected);
    verifyGatewayAndTool(source);
    verifyFeatures(source);
    verifyEnvironmentBoundaries(source);
    verifyExcludedFiles(source);
    await syncDemo({
      baseline: baselinePath,
      check: true,
      expected,
      root: demoRoot,
    });
  },
  GENERATION_TIMEOUT_MS
);
