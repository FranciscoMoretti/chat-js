import { z } from "zod";

/** Normalize empty environment strings before optional/default validation.
 * @param {unknown} value Raw schema input preserved unchanged unless it is the empty string.
 * @returns {unknown} The original input value, or undefined for an empty string.
 */
const normalizeEmptyEnvironmentValue = (value: unknown): unknown => {
  if (value === "") {
    // oxlint-disable-next-line no-undefined -- Normalize an empty environment string to the absent value expected by Zod optional/default handling.
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
  const url =
    // oxlint-disable-next-line no-ternary -- Keep url as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    purpose === "migration"
      ? // oxlint-disable-next-line typescript/prefer-nullish-coalescing, typescript/strict-boolean-expressions -- An empty migration URL means unset and must fall back to DATABASE_URL; preserve the short-circuit single migration-URL getter read.
        environment.DATABASE_MIGRATION_URL || environment.DATABASE_URL
      : environment.DATABASE_URL;
  if (typeof url !== "string" || url === "") {
    throw new Error(
      "DATABASE_URL is required (or DATABASE_MIGRATION_URL for schema operations)"
    );
  }
  const max =
    // oxlint-disable-next-line no-ternary -- Keep max as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    purpose === "migration"
      ? MIGRATION_MAX_CONNECTIONS
      : environment.DATABASE_MAX_CONNECTIONS;
  return {
    options: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties, no-undefined, no-ternary -- An absent max omits the pool-size key rather than passing undefined to the driver. Conditional spread (max === undefined ? {} : { max }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      ...(max === undefined ? {} : { max }),
      prepare:
        // oxlint-disable-next-line no-ternary -- Keep prepare as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        purpose === "migration"
          ? false
          : (environment.DATABASE_PREPARE ?? true),
    },
    url,
  };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (databaseConnection, databaseEnvOptions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { databaseConnection, databaseEnvOptions };
/* oxlint-enable import/no-named-export */
