import { isNonEmptyString } from "../is-non-empty-string";

import { z } from "zod";

/** Normalize empty environment strings before optional/default validation.
 * @param {unknown} value Raw schema input preserved unchanged unless it is the empty string.
 * @returns {unknown} The original input value, or undefined for an empty string.
 */
const normalizeEmptyEnvironmentValue = (value: unknown): unknown => {
  if (value === "") {
    return undefined;
  }
  return value;
};

const MIGRATION_URL_MINIMUM_LENGTH = 1;
const MIGRATION_MAX_CONNECTIONS = 1;

const databaseEnvOptions = {
  DATABASE_MAX_CONNECTIONS: z
    .preprocess(
      normalizeEmptyEnvironmentValue,
      z.coerce.number().int().positive().optional()
    )
    .describe("Maximum runtime connections per app process"),
  DATABASE_MIGRATION_URL: z
    .preprocess(
      normalizeEmptyEnvironmentValue,
      z.string().min(MIGRATION_URL_MINIMUM_LENGTH).optional()
    )
    .describe("Optional direct Postgres connection for schema operations"),
  DATABASE_PREPARE: z
    .preprocess(
      normalizeEmptyEnvironmentValue,
      z.enum(["true", "false"]).default("true")
    )
    .transform((value) => value === "true")
    .describe("Enable prepared statements for runtime queries"),
};

const databaseConnection = (
  environment: {
    readonly DATABASE_URL?: string;
    readonly DATABASE_MIGRATION_URL?: string;
    readonly DATABASE_PREPARE?: boolean;
    readonly DATABASE_MAX_CONNECTIONS?: number;
  },
  purpose: "runtime" | "migration" = "runtime"
): { options: { prepare: boolean; max?: number | undefined }; url: string } => {
  const migrationUrl =
    purpose === "migration" ? environment.DATABASE_MIGRATION_URL : undefined;
  const url = isNonEmptyString(migrationUrl)
    ? migrationUrl
    : environment.DATABASE_URL;
  if (typeof url !== "string" || url === "") {
    throw new Error(
      "DATABASE_URL is required (or DATABASE_MIGRATION_URL for schema operations)"
    );
  }
  const max =
    purpose === "migration"
      ? MIGRATION_MAX_CONNECTIONS
      : environment.DATABASE_MAX_CONNECTIONS;
  return {
    options: {
      ...(max === undefined ? {} : { max }),
      prepare:
        purpose === "migration"
          ? false
          : (environment.DATABASE_PREPARE ?? true),
    },
    url,
  };
};
export { databaseConnection, databaseEnvOptions };
