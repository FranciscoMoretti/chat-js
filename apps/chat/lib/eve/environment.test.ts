import { hkdfSync } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { eveRuntimeEnvOptions } from "../env-schema";
import {
  configureWorkflowEnvironment,
  resolveEveEnvironment,
  resolveWorkflowDatabaseUrl,
} from "./environment";

const base = {
  AUTH_SECRET: "existing-application-secret-at-least-32-characters",
  DATABASE_URL: "postgres://localhost/chat",
};
const schema = z.object(eveRuntimeEnvOptions);

describe("EVE environment defaults", () => {
  it("derives a stable separate key matching Node's HKDF implementation", () => {
    const first = resolveEveEnvironment(base);
    expect(schema.safeParse(first).success).toBe(true);
    expect(first.EVE_GATEWAY_SECRET).toBe(
      Buffer.from(
        hkdfSync("sha256", base.AUTH_SECRET, "chatjs", "eve-gateway/v1", 32)
      ).toString("hex")
    );
    expect(resolveEveEnvironment({ ...base })).toEqual(first);
    expect(first.EVE_GATEWAY_SECRET).not.toBe(base.AUTH_SECRET);
    expect(
      resolveEveEnvironment({ ...base, AUTH_SECRET: "rotated" })
        .EVE_GATEWAY_SECRET
    ).not.toBe(first.EVE_GATEWAY_SECRET);
    expect(
      resolveEveEnvironment({
        ...base,
        VERCEL_URL: "new-deployment.vercel.app",
      }).EVE_GATEWAY_SECRET
    ).toBe(first.EVE_GATEWAY_SECRET);
  });

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
        EVE_GATEWAY_SECRET: "",
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

it("the application env exposes derived values without any EVE overrides", async () => {
  for (const key of [
    "EVE_GATEWAY_SECRET",
    "EVE_INTERNAL_ORIGIN",
    "WORKFLOW_POSTGRES_URL",
    "DATABASE_MIGRATION_URL",
  ]) {
    vi.stubEnv(key, "");
  }
  vi.stubEnv("AUTH_SECRET", base.AUTH_SECRET);
  vi.stubEnv("DATABASE_URL", base.DATABASE_URL);
  vi.stubEnv("VERCEL_URL", "deployment.vercel.app");
  const { env } = await import("../env");
  expect(env.EVE_GATEWAY_SECRET).toBe(
    resolveEveEnvironment(base).EVE_GATEWAY_SECRET
  );
  expect(env.EVE_INTERNAL_ORIGIN).toBe("https://deployment.vercel.app");
  expect(env.WORKFLOW_POSTGRES_URL).toBe(base.DATABASE_URL);
});

it("does not expose derived server credentials to client components", async () => {
  vi.stubGlobal("window", {});
  vi.stubEnv("AUTH_SECRET", base.AUTH_SECRET);
  const { env } = await import("../env");
  expect(() => env.EVE_GATEWAY_SECRET).toThrow();
  expect(() => env.WORKFLOW_POSTGRES_URL).toThrow();
});
