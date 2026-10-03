import { z } from "zod";

/* oxlint-disable import/group-exports, no-magic-numbers, no-undefined  --
 * import/group-exports (#523): databaseEnvOptions stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named databaseEnvOptions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): databaseEnvOptions uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): databaseEnvOptions derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): databaseEnvOptions uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
export const databaseEnvOptions = {
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
/* oxlint-enable import/group-exports, no-magic-numbers, no-undefined */

/* oxlint-disable import/group-exports, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/group-exports (#523): databaseConnection stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named databaseConnection API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): databaseConnection uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): databaseConnection derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): databaseConnection uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-rest-spread-properties (#543): databaseConnection copies or separates ...(max === undefined ? {} : { max }) while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep databaseConnection's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep databaseConnection's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): databaseConnection accepts environment: { DATABASE_URL?: string; DATABASE_MIGRATION_URL?: string; DATABASE_PREPA; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): databaseConnection intentionally keeps the existing falsy-value behavior of environment.DATABASE_MIGRATION_URL; url; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const databaseConnection = (
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
/* oxlint-enable import/group-exports, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
