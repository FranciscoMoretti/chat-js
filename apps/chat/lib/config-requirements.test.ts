import { expect, test } from "vitest";

import { getMissingRequirement } from "./config-requirements";
import type { EnvRequirement } from "./config-requirements";

const sandbox: EnvRequirement = {
  options: [
    ["VERCEL_OIDC_TOKEN"],
    ["VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "VERCEL_TOKEN"],
  ],
  runtimeAuth: "vercel-oidc",
};

test("request-context OIDC does not need an environment token on Vercel", () => {
  expect(
    getMissingRequirement(sandbox, { NODE_ENV: "test", VERCEL: "1" })
  ).toBeNull();
  expect(getMissingRequirement(sandbox, { NODE_ENV: "test" })).not.toBeNull();
  expect(
    getMissingRequirement(sandbox, { NODE_ENV: "test", VERCEL: "0" })
  ).not.toBeNull();
  expect(
    getMissingRequirement(sandbox, {
      NODE_ENV: "test",
      VERCEL_OIDC_TOKEN: "token",
    })
  ).toBeNull();
  expect(
    getMissingRequirement(sandbox, {
      NODE_ENV: "test",
      VERCEL_PROJECT_ID: "project",
      VERCEL_TEAM_ID: "team",
      VERCEL_TOKEN: "token",
    })
  ).toBeNull();
});

test("Vercel runtime authentication does not bypass unrelated environment requirements", () => {
  expect(
    getMissingRequirement(
      { options: [["OTHER_API_KEY"]] },
      { NODE_ENV: "test", VERCEL: "1" }
    )
  ).not.toBeNull();
});
