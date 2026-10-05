import { z } from "zod";

const databaseEnvOptions = {
  DATABASE_MAX_CONNECTIONS: z
    .preprocess(
      // oxlint-disable-next-line no-undefined -- Normalize an empty environment string to the absent value expected by Zod optional/default handling.
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().positive().optional()
    )
    .describe("Maximum runtime connections per app process"),
  DATABASE_MIGRATION_URL: z
    .preprocess(
      // oxlint-disable-next-line no-undefined -- Normalize an empty environment string to the absent value expected by Zod optional/default handling.
      (value) => (value === "" ? undefined : value),
      // oxlint-disable-next-line no-magic-numbers -- A supplied migration URL must contain at least one character; empty values are normalized to absence above.
      z.string().min(1).optional()
    )
    .describe("Optional direct Postgres connection for schema operations"),
  DATABASE_PREPARE: z
    .preprocess(
      // oxlint-disable-next-line no-undefined -- Normalize an empty environment string to the absent value expected by Zod optional/default handling.
      (value) => (value === "" ? undefined : value),
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
    purpose === "migration"
      ? // oxlint-disable-next-line typescript/prefer-nullish-coalescing, typescript/strict-boolean-expressions -- An empty migration URL means unset and must fall back to DATABASE_URL; preserve the short-circuit single migration-URL getter read.
        environment.DATABASE_MIGRATION_URL || environment.DATABASE_URL
      : environment.DATABASE_URL;
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- Reject a missing or empty selected URL before reading pool settings; retain the current falsy-value guard at this environment boundary.
  if (!url) {
    throw new Error(
      "DATABASE_URL is required (or DATABASE_MIGRATION_URL for schema operations)"
    );
  }
  const max =
    // oxlint-disable-next-line no-magic-numbers -- Schema operations use exactly one connection rather than the configured runtime pool size.
    purpose === "migration" ? 1 : environment.DATABASE_MAX_CONNECTIONS;
  return {
    options: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties, no-undefined -- An absent max omits the pool-size key rather than passing undefined to the driver. Conditional spread (max === undefined ? {} : { max }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
      ...(max === undefined ? {} : { max }),
      prepare:
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
