import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { authSessionOptions } from "./auth-session-options";
import { getBaseUrl } from "./url";

const mocks = vi.hoisted(() => ({
  env: {
    APP_URL: "",
    VERCEL_BRANCH_URL: "branch.example.com",
    VERCEL_ENV: "preview",
    VERCEL_URL: "deployment.example.com",
  },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));

beforeEach(() => {
  mocks.env.APP_URL = "";
  mocks.env.VERCEL_ENV = "preview";
  mocks.env.VERCEL_URL = "deployment.example.com";
});
it("uses a stable preview origin for callbacks and trusted origins", () => {
  expect(getBaseUrl()).toBe("https://branch.example.com");
});
it("preserves explicitly configured origins", () => {
  mocks.env.APP_URL = "https://custom.example.com";
  expect(getBaseUrl()).toBe("https://custom.example.com");
});
it("does not use the preview branch hostname outside previews", () => {
  mocks.env.VERCEL_ENV = "production";
  expect(getBaseUrl()).toBe("https://deployment.example.com");
});

afterEach(() => vi.unstubAllEnvs());

const localPrefix = () =>
  authSessionOptions({
    baseUrl: getBaseUrl(),
    databaseUrl: "postgres://dev:secret@localhost:5432/chat",
    development: true,
  }).advanced.cookiePrefix;

it("isolates direct Next starts using the actual listener port without APP_URL", () => {
  mocks.env.VERCEL_ENV = "";
  mocks.env.VERCEL_URL = "";
  vi.stubEnv("PORT", "3100");
  expect(getBaseUrl()).toBe("http://localhost:3100");
  const first = localPrefix();
  vi.stubEnv("PORT", "3200");
  expect(getBaseUrl()).toBe("http://localhost:3200");
  expect(localPrefix()).not.toBe(first);
  vi.stubEnv("PORT", undefined);
  expect(getBaseUrl()).toBe("http://localhost:3000");
});
