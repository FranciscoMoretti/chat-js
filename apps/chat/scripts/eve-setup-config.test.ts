import { describe, expect, it } from "vitest";

import { resolveEveSetup } from "./eve-setup-config";

const world = "@workflow/world-postgres";

describe("EVE setup selection", () => {
  it("skips PostgreSQL provisioning on Vercel even with a stale URL", () => {
    expect(resolveEveSetup("vercel")).toEqual({ local: false, managed: true });
    expect(resolveEveSetup("vercel", "not-a-database")).toEqual({
      local: false,
      managed: true,
    });
  });

  it("rejects unsupported worlds before considering database configuration", () => {
    expect(() => resolveEveSetup("@workflow/world-other")).toThrow(
      "does not support world"
    );
  });

  it.each([undefined, ""])("explains missing database fallbacks: %s", (url) => {
    expect(() => resolveEveSetup(world, url)).toThrow(
      "Set WORKFLOW_POSTGRES_URL to a direct or session PostgreSQL URL, or provide DATABASE_MIGRATION_URL or DATABASE_URL (checked in that order as fallbacks)."
    );
  });

  it.each(["postgres://%", "https://example.com"])(
    "rejects an invalid workflow URL after connection resolution: %s",
    (url) => {
      expect(() => resolveEveSetup(world, url)).toThrow();
    }
  );

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "enables the existing local lifecycle setup for %s",
    (host) => {
      expect(resolveEveSetup(world, `postgres://${host}/workflow`).local).toBe(
        true
      );
    }
  );

  it.each(["db", "db.example.com", "localhost.example.com"])(
    "accepts hosted/service connections without claiming local lifecycle support: %s",
    (host) => {
      expect(resolveEveSetup(world, `postgres://${host}/workflow`).local).toBe(
        false
      );
    }
  );
});

it.each([
  "postgres://db/workflows?pool_mode=transaction",
  "postgresql://postgres:secret@db.project.supabase.co:6543/postgres",
])("rejects transaction-pooled connections during setup too: %s", (url) => {
  expect(() => resolveEveSetup(world, url)).toThrow("direct or session");
  expect(() => resolveEveSetup(world, url)).not.toThrow("secret");
});
