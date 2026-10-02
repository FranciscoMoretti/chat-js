import { expect, test } from "bun:test";

import { getLangfuseEnvironment } from "./langfuse/env";

for (const environment of [
  {},
  { LANGFUSE_PUBLIC_KEY: "test-public" },
  { LANGFUSE_SECRET_KEY: "test-secret" },
]) {
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
    }
  });
}

test("Langfuse keeps exporter defaults and optional custom parameters", () => {
  const credentials = {
    LANGFUSE_PUBLIC_KEY: "test-public",
    LANGFUSE_SECRET_KEY: "test-secret",
  };
  expect(getLangfuseEnvironment(credentials)).toEqual({
    baseUrl: undefined,
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
  test(`Langfuse validates credentials only in its Node runtime: ${runtime}, Playwright ${playwright}`, () => {
    const child = Bun.spawnSync(
      [
        process.execPath,
        "-e",
        `import { register } from "${new URL("langfuse/instrumentation.ts", import.meta.url).pathname}";
try { await register({ appPrefix: "test", runtime: "${runtime}" }); console.log("registered"); }
catch (error) { console.log(error.code + ":" + error.integration); process.exitCode = 1; }`,
      ],
      {
        env: {
          ...process.env,
          CI_PLAYWRIGHT: "false",
          LANGFUSE_PUBLIC_KEY: "",
          LANGFUSE_SECRET_KEY: "",
          PLAYWRIGHT: playwright ? "true" : "false",
          PLAYWRIGHT_TEST_BASE_URL: "",
        },
      }
    );
    expect(child.exitCode).toBe(runtime === "nodejs" && !playwright ? 1 : 0);
    expect(child.stdout.toString().trim()).toBe(
      runtime === "nodejs" && !playwright
        ? "CHATJS_MISSING_CREDENTIALS:langfuse"
        : "registered"
    );
  });
}

test("successful Node registration configures one exporter with application identity and explicit options", () => {
  const child = Bun.spawnSync(
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
      env: {
        ...process.env,
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
  expect(child.exitCode).toBe(0);
  expect(child.stdout.toString().trim()).toBe("registered once");
  expect(child.stderr.toString()).toBe("");
});
