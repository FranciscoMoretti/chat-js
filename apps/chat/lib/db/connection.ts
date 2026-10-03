import { z } from "zod";

/* oxlint-disable no-magic-numbers, no-undefined -- no-magic-numbers (#517): databaseEnvOptions uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): databaseEnvOptions uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
const databaseEnvOptions = {
  DATABASE_MAX_CONNECTIONS: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().positive().optional()
    )
    .describe("Maximum runtime connections per app process"),
  DATABASE_MIGRATION_URL: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional()
    )
    .describe("Optional direct Postgres connection for schema operations"),
  DATABASE_PREPARE: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.enum(["true", "false"]).default("true")
    )
    .transform((value) => value === "true")
    .describe("Enable prepared statements for runtime queries"),
};
/* oxlint-enable no-magic-numbers, no-undefined */

/* oxlint-disable no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- no-magic-numbers (#517): databaseConnection uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
no-undefined (#519): databaseConnection uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
typescript/explicit-function-return-type (#560): Keep databaseConnection's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep databaseConnection's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): databaseConnection accepts environment: { DATABASE_URL?: string; DATABASE_MIGRATION_URL?: string; DATABASE_PREPA; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): databaseConnection intentionally keeps the existing falsy-value behavior of environment.DATABASE_MIGRATION_URL; url; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const databaseConnection = (
  environment: {
    DATABASE_URL?: string;
    DATABASE_MIGRATION_URL?: string;
    DATABASE_PREPARE?: boolean;
    DATABASE_MAX_CONNECTIONS?: number;
  },
  purpose: "runtime" | "migration" = "runtime"
) => {
  const url =
    purpose === "migration"
      ? // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
        environment.DATABASE_MIGRATION_URL || environment.DATABASE_URL
      : environment.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is required (or DATABASE_MIGRATION_URL for schema operations)"
    );
  }
  const max =
    purpose === "migration" ? 1 : environment.DATABASE_MAX_CONNECTIONS;
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
/* oxlint-enable no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
export { databaseConnection, databaseEnvOptions };
