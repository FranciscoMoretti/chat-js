import { describe, expect, it } from "vitest";
import { z } from "zod";

import { databaseConnection, databaseEnvOptions } from "./connection";

const databaseOptionsSchema = z.object(databaseEnvOptions);

describe("Postgres connection selection", () => {
  it("keeps runtime and migration destinations separate", () => {
    const environment = {
      DATABASE_MAX_CONNECTIONS: 3,
      DATABASE_MIGRATION_URL: "postgres://direct.invalid/app",
      DATABASE_PREPARE: false,
      DATABASE_URL: "postgres://runtime.invalid/app",
    };
    expect(databaseConnection(environment)).toEqual({
      options: { max: 3, prepare: false },
      url: environment.DATABASE_URL,
    });
    expect(databaseConnection(environment, "migration")).toEqual({
      options: { max: 1, prepare: false },
      url: environment.DATABASE_MIGRATION_URL,
    });
  });
  it("falls back to the application URL for schema operations", () => {
    expect(
      databaseConnection(
        { DATABASE_URL: "postgres://localhost/app" },
        "migration"
      ).url
    ).toBe("postgres://localhost/app");
    expect(() => databaseConnection({})).toThrow("DATABASE_URL");
  });
  it("parses explicit pool settings and treats blank optional variables as absent", () => {
    expect(
      databaseOptionsSchema.parse({
        DATABASE_MAX_CONNECTIONS: "2",
        DATABASE_PREPARE: "false",
      })
    ).toEqual({ DATABASE_MAX_CONNECTIONS: 2, DATABASE_PREPARE: false });
    const blank = databaseOptionsSchema.parse({
      DATABASE_MAX_CONNECTIONS: "",
      DATABASE_MIGRATION_URL: "",
      DATABASE_PREPARE: "",
    });
    expect(blank.DATABASE_PREPARE).toBe(true);
    expect(blank.DATABASE_MIGRATION_URL).toBeUndefined();
    expect(blank.DATABASE_MAX_CONNECTIONS).toBeUndefined();
    expect(() =>
      databaseOptionsSchema.parse({ DATABASE_MAX_CONNECTIONS: "0" })
    ).toThrow();
    expect(() =>
      databaseOptionsSchema.parse({ DATABASE_PREPARE: "maybe" })
    ).toThrow();
  });
});
