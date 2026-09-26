import { describe, expect, test } from "vitest";
import { z } from "zod";

import { getEveRuntimeEnvOptions } from "./env-schema";

const schema = z.object(getEveRuntimeEnvOptions({}));
const valid = {
  EVE_GATEWAY_SECRET: "a".repeat(32),
  EVE_INTERNAL_ORIGIN: "http://localhost:3000",
  WORKFLOW_POSTGRES_URL: "postgresql://localhost/eve",
};

describe("EVE runtime environment", () => {
  test("requires the complete runtime contract", () => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  test.each([
    { ...valid, EVE_GATEWAY_SECRET: "short" },
    { ...valid, EVE_INTERNAL_ORIGIN: "postgresql://localhost/eve" },
    { ...valid, WORKFLOW_POSTGRES_URL: "https://localhost/eve" },
  ])("rejects malformed runtime configuration", (value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });
});

test.each(["preview", "production"])(
  "Vercel %s needs no workflow database",
  (VERCEL_ENV) => {
    const managed = z.object(
      getEveRuntimeEnvOptions({ VERCEL: "1", VERCEL_ENV })
    );
    const { WORKFLOW_POSTGRES_URL: _unused, ...credentials } = valid;
    expect(managed.safeParse(credentials).success).toBe(true);
    expect(
      managed.safeParse({ ...credentials, WORKFLOW_POSTGRES_URL: "" }).success
    ).toBe(true);
    expect(
      managed.safeParse({ ...credentials, EVE_GATEWAY_SECRET: "short" }).success
    ).toBe(false);
    expect(schema.safeParse(credentials).success).toBe(false);
  }
);
