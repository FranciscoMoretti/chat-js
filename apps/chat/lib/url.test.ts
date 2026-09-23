import { beforeEach, expect, it, vi } from "vitest";

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
