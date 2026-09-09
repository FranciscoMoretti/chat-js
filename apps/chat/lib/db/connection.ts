import { z } from "zod";

export const databaseEnvOptions = {
  DATABASE_MIGRATION_URL: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional()
    )
    .describe("Optional direct Postgres connection for schema operations"),
  DATABASE_PREPARE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true")
    .describe("Enable prepared statements for runtime queries"),
  DATABASE_MAX_CONNECTIONS: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().positive().optional()
    )
    .describe("Maximum runtime connections per app process"),
};

export function databaseConnection(
  environment: {
    DATABASE_URL?: string;
    DATABASE_MIGRATION_URL?: string;
    DATABASE_PREPARE?: boolean;
    DATABASE_MAX_CONNECTIONS?: number;
  },
  purpose: "runtime" | "migration" = "runtime"
) {
  const url =
    purpose === "migration"
      ? environment.DATABASE_MIGRATION_URL || environment.DATABASE_URL
      : environment.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required (or DATABASE_MIGRATION_URL for schema operations)"
    );
  }
  const max =
    purpose === "migration" ? 1 : environment.DATABASE_MAX_CONNECTIONS;
  return {
    url,
    options: {
      prepare:
        purpose === "migration"
          ? false
          : (environment.DATABASE_PREPARE ?? true),
      ...(max === undefined ? {} : { max }),
    },
  };
}
