import { expect, it, vi } from "vitest";

import { localDeletionAvailable } from "./local-deletion-available";

const mocks = vi.hoisted(() => ({
  env: {
    EVE_INTERNAL_ORIGIN: "http://localhost:3000",
    VERCEL: "",
    VERCEL_ENV: "production",
    WORKFLOW_POSTGRES_URL: "postgres://localhost/workflow",
  },
}));
vi.mock("../env", () => ({ env: mocks.env }));

it("does not enable local SQL deletion on Vercel through leftover local URLs", () => {
  expect(localDeletionAvailable()).toBe(true);
  mocks.env.VERCEL = "1";
  expect(localDeletionAvailable()).toBe(false);
});
