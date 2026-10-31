import { generateDemo } from "../scripts/demo-generator";
import { createDemoMirror } from "../scripts/demo-mirror";
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
  expect(required(expected, "chatjs/providers/gateway-defaults.ts")).toContain(
    'chat: "google/gemini-2.5-flash-lite"'
  );
  expect(
    required(expected, "chatjs/tools/code-execution/renderer.tsx")
  ).toContain('from "@/components/sandbox.tsx"');
};

const verifyPlugins = (expected: Readonly<Record<string, string>>): void => {
  for (const id of [
    "mcp",
    "attachment-uploads",
    "vercel-analytics",
    "vercel-speed-insights",
    "langfuse",
  ]) {
    expect(Object.hasOwn(expected, `chatjs/plugins/${id}/chatjs.json`)).toBe(
      true
    );
    expect(required(expected, "chatjs/generated/installed.ts")).toContain(
      `"${id}"`
    );
  }
  expect(required(expected, "chatjs/generated/installed-uploads.ts")).toContain(
    "@/chatjs/plugins/attachment-uploads/client-plugin"
  );
  expect(required(expected, "chatjs/generated/installed-layout.ts")).toContain(
    "@/chatjs/plugins/vercel-speed-insights/client-plugin"
  );
  expect(
    required(expected, "chatjs/generated/installed-instrumentation.ts")
  ).toContain("@/chatjs/plugins/langfuse/server-plugin");
};

const verifyEnvironmentBoundaries = (
  expected: Readonly<Record<string, string>>
): void => {
  for (const [file, reader] of [
    ["chatjs/plugins/mcp/setup.ts", "./mcp-env"],
    ["chatjs/tools/retrieve-url/tool.ts", "./retrieve-url-env"],
    ["chatjs/tools/tavily-search/tool.ts", "./tavily-search-env"],
    ["chatjs/providers/sandbox/adapter.ts", "./vercel-sandbox-env"],
  ] as const) {
    expect(required(expected, file)).toContain(`from "${reader}"`);
    expect(required(expected, file)).not.toContain('from "@/lib/env"');
    expect(required(expected, file)).not.toContain(
      "@/chatjs/plugins/langfuse/"
    );
  }
  // Database credentials still belong to core, even for an installable query.
  expect(
    required(expected, "chatjs/plugins/mcp/db/mcp-oauth-lock.ts")
  ).toContain('from "@/lib/env"');
};

const verifyExcludedFiles = (
  expected: Readonly<Record<string, string>>
): void => {
  for (const file of [
    "test-json.ts",
    "chatjs/plugins/test-runtime.ts",
    "composer-controls.ts",
    "composition/custom/custom-tools.ts",
    "composition/custom/custom-ui.ts",
  ]) {
    expect(Object.hasOwn(expected, file)).toBe(false);
  }
};

test(
  "demo stays aligned with full canonical installation source",
  async () => {
    const { files: expected } = await generateDemo();
    const source = Object.fromEntries(expected);
    verifyGatewayAndTool(source);
    verifyPlugins(source);
    verifyEnvironmentBoundaries(source);
    verifyExcludedFiles(source);
    await createDemoMirror().run({ check: true });
  },
  GENERATION_TIMEOUT_MS
);
