import { expect, test } from "bun:test";

import { getLangfuseEnvironment } from "./langfuse/credentials";
import { runTestProcess } from "./test-runtime";

const SUCCESS_EXIT_CODE = 0;
const MISSING_CREDENTIALS_EXIT_CODE = 1;

for (const environment of [
  { NODE_ENV: "test" },
  { LANGFUSE_PUBLIC_KEY: "test-public", NODE_ENV: "test" },
  { LANGFUSE_SECRET_KEY: "test-secret", NODE_ENV: "test" },
] as const) {
  test(`Langfuse rejects missing credentials: ${Object.keys(environment).join(",") || "both"}`, () => {
    expect(() => getLangfuseEnvironment(environment)).toThrow(
      "Missing credentials for langfuse: LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY"
    );
    try {
      getLangfuseEnvironment(environment);
    } catch (error) {
      expect(error).toMatchObject({
        code: "CHATJS_MISSING_CREDENTIALS",
        integration: "langfuse",
      });
      expect(String(error)).not.toContain("test-secret");
      expect(String(error)).not.toContain("test-public");
    }
  });
}

test("Langfuse keeps exporter defaults and optional custom parameters", () => {
  const credentials = {
    LANGFUSE_PUBLIC_KEY: "test-public",
    LANGFUSE_SECRET_KEY: "test-secret",
    NODE_ENV: "test" as const,
  };
  const defaults = getLangfuseEnvironment(credentials);
  const { baseUrl, ...rest } = defaults;
  expect(Object.hasOwn(defaults, "baseUrl")).toBe(true);
  expect(baseUrl).toBeUndefined();
  expect(rest).toEqual({
    debug: false,
    publicKey: "test-public",
    secretKey: "test-secret",
  });
  expect(
    getLangfuseEnvironment({
      ...credentials,
      LANGFUSE_BASE_URL: "https://langfuse.example",
      LANGFUSE_DEBUG: "true",
    })
  ).toMatchObject({ baseUrl: "https://langfuse.example", debug: true });
});

for (const { runtime, playwright } of [
  { playwright: false, runtime: "nodejs" },
  { playwright: false, runtime: "edge" },
  { playwright: true, runtime: "nodejs" },
]) {
  test(`Langfuse validates credentials only in its Node runtime: ${runtime}, Playwright ${playwright}`, async () => {
    const child = await runTestProcess(
      [
        process.execPath,
        "-e",
        `import { register } from "${new URL("langfuse/instrumentation.ts", import.meta.url).pathname}";
try { await register({ appPrefix: "test", runtime: "${runtime}" }); console.log("registered"); }
catch (error) { console.log(error.code + ":" + error.integration); process.exitCode = 1; }`,
      ],
      {
        environment: {
          CI_PLAYWRIGHT: "false",
          LANGFUSE_PUBLIC_KEY: "",
          LANGFUSE_SECRET_KEY: "",
          PLAYWRIGHT: playwright ? "true" : "false",
          PLAYWRIGHT_TEST_BASE_URL: "",
        },
      }
    );
    expect(child.exitCode).toBe(
      runtime === "nodejs" && !playwright
        ? MISSING_CREDENTIALS_EXIT_CODE
        : SUCCESS_EXIT_CODE
    );
    expect(child.stdout.trim()).toBe(
      runtime === "nodejs" && !playwright
        ? "CHATJS_MISSING_CREDENTIALS:langfuse"
        : "registered"
    );
  });
}

test("successful Node registration configures one exporter with application identity and explicit options", async () => {
  const child = await runTestProcess(
    [
      process.execPath,
      "-e",
      `import assert from "node:assert/strict";
import { mock } from "bun:test";
const exporters = [];
const registrations = [];
class Exporter {
  constructor(options) { this.options = options; exporters.push(this); }
}
mock.module("@vercel/otel", () => ({ registerOTel: (options) => registrations.push(options) }));
mock.module("langfuse-vercel", () => ({ LangfuseExporter: Exporter }));
const { register } = await import("${new URL("langfuse/instrumentation.ts", import.meta.url).pathname}");
await register({ appPrefix: "custom-app", runtime: "nodejs" });
assert.equal(exporters.length, 1);
assert.equal(registrations.length, 1);
assert.equal(registrations[0].serviceName, "custom-app");
assert.equal(registrations[0].traceExporter, exporters[0]);
assert.deepEqual(exporters[0].options, {
  baseUrl: "https://langfuse.example",
  debug: true,
  publicKey: "test-public",
  secretKey: "test-secret",
});
console.log("registered once");`,
    ],
    {
      environment: {
        CI_PLAYWRIGHT: "false",
        LANGFUSE_BASE_URL: "https://langfuse.example",
        LANGFUSE_DEBUG: "true",
        LANGFUSE_PUBLIC_KEY: "test-public",
        LANGFUSE_SECRET_KEY: "test-secret",
        PLAYWRIGHT: "false",
        PLAYWRIGHT_TEST_BASE_URL: "",
      },
    }
  );
  expect(child.exitCode).toBe(SUCCESS_EXIT_CODE);
  expect(child.stdout.trim()).toBe("registered once");
  expect(child.stderr).toBe("");
});
