import { describe, expect, it } from "vitest";

import { resolveWorkflowWorld } from "./world-config";

describe("workflow deployment contract", () => {
  it.each(["preview", "production"])(
    "selects managed Workflow for Vercel %s",
    (VERCEL_ENV) => {
      expect(
        resolveWorkflowWorld({
          NODE_ENV: "production",
          VERCEL: "1",
          VERCEL_ENV,
        })
      ).toBe("vercel");
    }
  );

  it.each([
    {},
    { NODE_ENV: "production" },
    { NODE_ENV: "test" },
    { VERCEL: "0", VERCEL_ENV: "production" },
    { VERCEL_ENV: "production" },
    { VERCEL: "1", VERCEL_ENV: "development" },
    { NODE_ENV: "development", VERCEL: "1", VERCEL_ENV: "preview" },
  ])(
    "keeps local/dev/self-hosted execution on PostgreSQL: %j",
    (environment) => {
      expect(resolveWorkflowWorld(environment)).toBe(
        "@workflow/world-postgres"
      );
    }
  );
});
