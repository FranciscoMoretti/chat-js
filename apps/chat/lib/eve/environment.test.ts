import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { getEveRuntimeEnvOptions } from "../env-schema";
import {
  configureWorkflowEnvironment,
  resolveEveEnvironment,
  resolveWorkflowDatabaseUrl,
} from "./environment";

const base = {
  AUTH_SECRET: "existing-application-secret-at-least-32-characters",
  DATABASE_URL: "postgres://localhost/chat",
  EVE_GATEWAY_SECRET: "independently-generated-gateway-secret-32-characters",
};
const schema = z.object(getEveRuntimeEnvOptions({}));

describe("EVE environment defaults", () => {
  it("requires an independent gateway secret even when AUTH_SECRET is present", () => {
    for (const EVE_GATEWAY_SECRET of [undefined, "", "short"]) {
      const resolved = resolveEveEnvironment({ ...base, EVE_GATEWAY_SECRET });
      expect(schema.safeParse(resolved).success).toBe(false);
      expect(
        z
          .object(
            getEveRuntimeEnvOptions({ VERCEL: "1", VERCEL_ENV: "preview" })
          )
          .safeParse(resolved).success
      ).toBe(false);
    }
    expect(
      resolveEveEnvironment({ ...base, AUTH_SECRET: "rotated" })
        .EVE_GATEWAY_SECRET
    ).toBe(base.EVE_GATEWAY_SECRET);
  });

  it.each(["preview", "production"])(
    "does not initialize PostgreSQL workflows on Vercel %s",
    (VERCEL_ENV) => {
      const source = {
        ...base,
        DATABASE_URL: "postgres://ep-test-pooler.region.aws.neon.tech/chat",
        VERCEL: "1",
        VERCEL_ENV,
      };
      const worker: Record<string, string | undefined> = { ...source };
      configureWorkflowEnvironment(worker);
      expect(worker.WORKFLOW_POSTGRES_URL).toBeUndefined();
      expect(resolveWorkflowDatabaseUrl(source)).toBeUndefined();
      expect(
        z
          .object(getEveRuntimeEnvOptions(source))
          .safeParse(resolveEveEnvironment(source)).success
      ).toBe(true);
    }
  );

  it("uses the exact Vercel deployment ahead of app and branch aliases", () => {
    expect(
      resolveEveEnvironment({
        ...base,
        APP_URL: "https://production.example",
        VERCEL_BRANCH_URL: "branch.vercel.app",
        VERCEL_URL: "deployment.vercel.app",
      }).EVE_INTERNAL_ORIGIN
    ).toBe("https://deployment.vercel.app");
    expect(
      resolveEveEnvironment({ ...base, APP_URL: "https://self-hosted.example" })
        .EVE_INTERNAL_ORIGIN
    ).toBe("https://self-hosted.example");
    expect(
      resolveEveEnvironment({ ...base, PORT: "3110" }).EVE_INTERNAL_ORIGIN
    ).toBe("http://localhost:3110");
  });

  it.each(["APP_URL", "PLAYWRIGHT_TEST_BASE_URL"])(
    "derives a bare origin from %s without accepting unsafe configuration",
    (key) => {
      const resolved = resolveEveEnvironment({
        ...base,
        [key]: "https://example.com:8443/chat?mode=test#section",
      });
      expect(resolved.EVE_INTERNAL_ORIGIN).toBe("https://example.com:8443");
      expect(schema.safeParse(resolved).success).toBe(true);

      for (const value of [
        "not-a-url",
        "https://user:password@example.com/chat",
        "https://user@example.com/chat",
        "blob:https://example.com/id",
        "ftp://example.com/chat",
        "http://example.com/chat",
      ]) {
        expect(
          schema.safeParse(resolveEveEnvironment({ ...base, [key]: value }))
            .success
        ).toBe(false);
      }
    }
  );

  it("does not normalize an explicit origin override", () => {
    const EVE_INTERNAL_ORIGIN = "https://example.com/chat?mode=test#section";
    const resolved = resolveEveEnvironment({
      ...base,
      APP_URL: "https://valid.example/chat",
      EVE_INTERNAL_ORIGIN,
    });
    expect(resolved.EVE_INTERNAL_ORIGIN).toBe(EVE_INTERNAL_ORIGIN);
    expect(schema.safeParse(resolved).success).toBe(false);
  });

  it("preserves explicit overrides and treats empty env-example values as absent", () => {
    const overrides = {
      EVE_GATEWAY_SECRET: "x".repeat(32),
      EVE_INTERNAL_ORIGIN: "https://worker.example",
      WORKFLOW_POSTGRES_URL: "postgres://localhost/workflows",
    };
    expect(resolveEveEnvironment({ ...base, ...overrides })).toEqual(overrides);
    expect(
      resolveEveEnvironment({
        ...base,
        EVE_INTERNAL_ORIGIN: "",
        WORKFLOW_POSTGRES_URL: "",
      })
    ).toEqual(resolveEveEnvironment(base));
    expect(
      schema.safeParse(
        resolveEveEnvironment({ ...base, EVE_GATEWAY_SECRET: "short" })
      ).success
    ).toBe(false);
    expect(schema.safeParse(resolveEveEnvironment({})).success).toBe(false);
  });

  it("uses the same direct database for app resolution and provider initialization", () => {
    const source = {
      ...base,
      DATABASE_MIGRATION_URL: "postgres://direct.example/chat",
    };
    const worker: Record<string, string | undefined> = { ...source };
    configureWorkflowEnvironment(worker);
    expect(worker.WORKFLOW_POSTGRES_URL).toBe(source.DATABASE_MIGRATION_URL);
    expect(worker.WORKFLOW_POSTGRES_URL).toBe(
      resolveEveEnvironment(source).WORKFLOW_POSTGRES_URL
    );
    expect(resolveWorkflowDatabaseUrl(base)).toBe(base.DATABASE_URL);
    worker.WORKFLOW_POSTGRES_URL = "postgres://separate.example/workflows";
    configureWorkflowEnvironment(worker);
    expect(worker.WORKFLOW_POSTGRES_URL).toBe(
      "postgres://separate.example/workflows"
    );
  });

  it.each([
    "postgres://ep-test-pooler.region.aws.neon.tech/chat",
    "postgres://aws-0-region.pooler.supabase.com:6543/chat",
    "postgres://db/chat?pgbouncer=true",
    "postgres://db/chat?pool_mode=transaction",
  ])("rejects a known transaction pooler: %s", (DATABASE_URL) => {
    expect(
      schema.safeParse(resolveEveEnvironment({ ...base, DATABASE_URL })).success
    ).toBe(false);
    expect(
      schema.safeParse(
        resolveEveEnvironment({
          ...base,
          DATABASE_MIGRATION_URL: "postgres://direct.example/chat",
          DATABASE_URL,
        })
      ).success
    ).toBe(true);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("the application env resolves defaults with an explicit gateway secret", async () => {
  for (const key of [
    "EVE_INTERNAL_ORIGIN",
    "WORKFLOW_POSTGRES_URL",
    "DATABASE_MIGRATION_URL",
  ]) {
    vi.stubEnv(key, "");
  }
  vi.stubEnv("AUTH_SECRET", base.AUTH_SECRET);
  vi.stubEnv("EVE_GATEWAY_SECRET", base.EVE_GATEWAY_SECRET);
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("DATABASE_URL", base.DATABASE_URL);
  vi.stubEnv("VERCEL_URL", "deployment.vercel.app");
  const { env } = await import("../env");
  expect(env.EVE_GATEWAY_SECRET).toBe(
    resolveEveEnvironment(base).EVE_GATEWAY_SECRET
  );
  expect(env.EVE_INTERNAL_ORIGIN).toBe("https://deployment.vercel.app");
  expect(env.WORKFLOW_POSTGRES_URL).toBe(base.DATABASE_URL);
});

it("does not expose server credentials to client components", async () => {
  vi.stubGlobal("window", {});
  vi.stubEnv("AUTH_SECRET", base.AUTH_SECRET);
  vi.stubEnv("EVE_GATEWAY_SECRET", base.EVE_GATEWAY_SECRET);
  vi.stubEnv("VERCEL", "");
  const { env } = await import("../env");
  expect(() => env.EVE_GATEWAY_SECRET).toThrow();
  expect(() => env.WORKFLOW_POSTGRES_URL).toThrow();
});

it("normalizes the schema's Playwright fallback URL", async () => {
  vi.stubEnv("PLAYWRIGHT", "True");
  vi.stubEnv("PLAYWRIGHT_TEST_BASE_URL", "http://[::1]:3110/chat?test=1#chat");
  vi.resetModules();
  const { serverEnvSchema } = await import("../env-schema");
  expect(serverEnvSchema.EVE_INTERNAL_ORIGIN.parse(undefined)).toBe(
    "http://[::1]:3110"
  );
});
