import { expect, test } from "bun:test";

/* oxlint-disable import/no-relative-parent-imports -- Compare against the package-private canonical demo installer; existing aliases and ./r-only exports do not resolve this source entry. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  baselinePath,
  demoRoot,
  generateDemo,
  syncDemo,
} from "../scripts/demo-sync";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

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
    required(expected, "tools/chatjs/vercel-code-execution/renderer.tsx")
  ).toContain('from "@/components/sandbox"');
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
  for (const file of [
    "features/mcp/setup.ts",
    "tools/chatjs/retrieve-url/tool.ts",
    "tools/chatjs/tavily-search/tool.ts",
    "lib/db/mcp-oauth-lock.ts",
    "tools/chatjs/vercel-code-execution/execution-sandbox.ts",
  ]) {
    expect(required(expected, file)).toContain('from "@/lib/env"');
    expect(required(expected, file)).not.toContain("@/features/langfuse/");
  }
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

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
