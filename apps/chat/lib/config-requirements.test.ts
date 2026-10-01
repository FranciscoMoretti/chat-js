import { expect, test } from "vitest";

import {
  authEnvRequirements,
  getMissingRequirement,
} from "./config-requirements";
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

test("Vercel OIDC satisfies credentials without bypassing a separate region requirement", () => {
  const requirement: EnvRequirement = {
    allOf: [sandbox, { options: [["RUNNER_REGION"]] }],
    options: [["VERCEL_OIDC_TOKEN", "RUNNER_REGION"]],
  };
  expect(
    getMissingRequirement(requirement, { NODE_ENV: "test", VERCEL: "1" })
  ).not.toBeNull();
  expect(
    getMissingRequirement(requirement, {
      NODE_ENV: "test",
      RUNNER_REGION: "eu",
      VERCEL: "1",
    })
  ).toBeNull();
  expect(
    getMissingRequirement(requirement, {
      NODE_ENV: "test",
      RUNNER_REGION: "eu",
    })
  ).not.toBeNull();
  expect(
    getMissingRequirement(requirement, {
      NODE_ENV: "test",
      RUNNER_REGION: "eu",
      VERCEL_OIDC_TOKEN: "token",
    })
  ).toBeNull();
});

test("formats nested allOf requirements without losing credential names", () => {
  expect(
    getMissingRequirement(
      {
        allOf: [{ allOf: [{ options: [["MISSING_KEY"]] }], options: [] }],
        options: [],
      },
      { NODE_ENV: "test" }
    )
  ).toContain("MISSING_KEY");
});

test("code execution credential descriptions retain actionable environment key names", () => {
  const described: EnvRequirement = {
    ...sandbox,
    description: "Vercel OIDC or team/project/token credentials",
  };
  const missing = getMissingRequirement(
    { allOf: [described], options: [] },
    { NODE_ENV: "test" }
  );
  for (const key of [
    "VERCEL_OIDC_TOKEN",
    "VERCEL_TEAM_ID",
    "VERCEL_PROJECT_ID",
    "VERCEL_TOKEN",
  ]) {
    expect(missing).toContain(key);
  }
  expect(
    getMissingRequirement(
      { allOf: [described], options: [] },
      { NODE_ENV: "test", VERCEL: "1" }
    )
  ).toBeNull();
});

test("credential descriptions avoid duplicate exact key names across separators", () => {
  const requirement = authEnvRequirements.github;
  expect(
    getMissingRequirement(
      { ...requirement, description: "" },
      { NODE_ENV: "test" }
    )
  ).toBe("AUTH_GITHUB_ID + AUTH_GITHUB_SECRET");
  expect(getMissingRequirement(requirement, { NODE_ENV: "test" })).toBe(
    requirement.description
  );
  expect(
    getMissingRequirement(
      {
        ...requirement,
        description: "AUTH_GITHUB_ID_EXTRA, AUTH_GITHUB_SECRET",
      },
      { NODE_ENV: "test" }
    )
  ).toContain("(AUTH_GITHUB_ID + AUTH_GITHUB_SECRET)");
});
