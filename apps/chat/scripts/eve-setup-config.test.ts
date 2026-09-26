import { describe, expect, it } from "vitest";

import { resolveEveSetup } from "./eve-setup-config";

const world = "@workflow/world-postgres";

describe("EVE setup selection", () => {
  it("rejects unsupported worlds before considering database configuration", () => {
    expect(() => resolveEveSetup("@workflow/world-other")).toThrow(
      "does not support world"
    );
  });

  it.each([undefined, "", "postgres://%", "https://example.com"])(
    "rejects an absent or invalid workflow URL after connection resolution: %s",
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

it("rejects transaction-pooled connections during setup too", () => {
  expect(() =>
    resolveEveSetup(world, "postgres://db/workflows?pool_mode=transaction")
  ).toThrow("direct or session");
});
