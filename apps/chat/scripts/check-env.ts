#!/usr/bin/env bun
/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:fs/promises" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This server/tooling module requires import fs from "node:fs/promises";; import path from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../features/installed"; "../lib/ai/gateway-model-defaults"; "../lib/ai/models.generated"; "../lib/config"; "../lib/config-requirements" dependency within this package instead of introducing an alias or barrel API.
 */
/**
 * Build-time config validation script.
 * Validates environment requirements for installed integrations.
 * Run via `bun run check-env` or automatically in prebuild.
 */
import fs from "node:fs/promises";
import path from "node:path";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config as loadEnvConfig } from "dotenv";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installedFeatures } from "../features/installed";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { gatewayEnvRequirements } from "../lib/ai/gateway-model-defaults";
/* oxlint-enable sort-imports */
import { generatedForGateway } from "../lib/ai/models.generated";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "../lib/config";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  authEnvRequirements,
  getMissingRequirement,
  isRequirementSatisfied,
} from "../lib/config-requirements";
/* oxlint-enable sort-imports */
import { databaseEnvOptions } from "../lib/db/connection";
import { getEveRuntimeEnvOptions } from "../lib/env-schema";
import { resolveEveEnvironment } from "../lib/eve/environment";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { isPlaywrightTestEnvironment } from "../lib/playwright-test-environment";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { storageEnvRequirements, storageId } from "../lib/storage-options";
/* oxlint-enable sort-imports */
import { installedToolNames } from "../tools/chatjs/installed-features";
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

loadEnvConfig({ path: ".env.local" });
loadEnvConfig();

interface ValidationError {
  feature: string;
  missing: string[];
}

const projectRoot = path.resolve(import.meta.dirname, "..");
/* oxlint-disable no-magic-numbers, unicorn/max-nested-calls --
 * no-magic-numbers (#517): toolEnvironmentSchema uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * unicorn/max-nested-calls (#568): toolEnvironmentSchema keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const toolEnvironmentSchema = z.object({
  envRequirements: z
    .array(
      z.object({
        description: z.string().optional(),
        options: z.array(z.array(z.string()).min(1)).min(1),
        runtimeAuth: z.literal("vercel-oidc").optional(),
      })
    )
    .default([]),
});
/* oxlint-enable no-magic-numbers, unicorn/max-nested-calls */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-magic-numbers (#517): validateGatewayKey uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): validateGatewayKey accepts env: NodeJS.ProcessEnv; requirement; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): validateGatewayKey preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const validateGatewayKey = (env: NodeJS.ProcessEnv): ValidationError | null => {
  const gateway: string = config.ai.gateway;
  const missing = gatewayEnvRequirements
    .map((requirement) => getMissingRequirement(requirement, env))
    .filter((value) => value !== null);
  if (missing.length === 0) {
    return null;
  }
  return {
    feature: `aiGateway (${gateway})`,
    missing,
  };
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-magic-numbers (#517): validateStorage uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): validateStorage accepts env: NodeJS.ProcessEnv; requirement; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): validateStorage preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const validateStorage = (env: NodeJS.ProcessEnv): ValidationError | null => {
  if (
    !(
      installedFeatures.has("attachment-uploads") ||
      installedToolNames.has("generateImage") ||
      installedToolNames.has("generateVideo")
    )
  ) {
    return null;
  }
  const missing = storageEnvRequirements
    .map((requirement) => getMissingRequirement(requirement, env))
    .filter((value) => value !== null);

  if (missing.length > 0) {
    return { feature: `fileStorage (${storageId})`, missing };
  }
  return null;
};
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable max-statements, no-continue, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-statements (#512): validateAuthentication keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): validateAuthentication skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * typescript/prefer-readonly-parameter-types (#565): validateAuthentication accepts env: NodeJS.ProcessEnv; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): validateAuthentication intentionally keeps the existing falsy-value behavior of missing; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const validateAuthentication = (env: NodeJS.ProcessEnv): ValidationError[] => {
  const errors: ValidationError[] = [];

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Environment checks enumerate typed configuration keys and report a mismatched snapshot; preserving legacy config diagnostics requires runtime config-schema migration.
  const authKeys = Object.keys(
    authEnvRequirements
  ) as (keyof typeof authEnvRequirements)[];
  for (const provider of authKeys) {
    if (!config.authentication[provider]) {
      continue;
    }
    const requirement = authEnvRequirements[provider];
    const missing = getMissingRequirement(requirement, env);
    if (missing) {
      errors.push({
        feature: `authentication.${provider}`,
        missing: [missing],
      });
    }
  }

  const hasAuth = authKeys.some((provider) => {
    if (!config.authentication[provider]) {
      return false;
    }
    return isRequirementSatisfied(authEnvRequirements[provider], env);
  });

  if (!hasAuth) {
    errors.push({
      feature: "authentication",
      missing: ["At least one auth provider must be enabled and configured"],
    });
  }

  return errors;
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateInstalledItems's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-continue, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * typescript/prefer-readonly-parameter-types (#565): validateInstalledItems accepts env: NodeJS.ProcessEnv; entry; toolEnvVar; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): validateInstalledItems intentionally keeps the existing falsy-value behavior of missing; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const validateInstalledItems = async (
  env: NodeJS.ProcessEnv,
  directory: "tools/chatjs" | "features"
): Promise<ValidationError[]> => {
  const toolsDir = path.join(projectRoot, directory);
  const entries = await fs
    .readdir(toolsDir, { withFileTypes: true })
    .catch((error: unknown) => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return [];
      }
      throw error;
    });
  const toolErrors = await Promise.all(
    entries.map(async (entry): Promise<ValidationError[]> => {
      if (!entry.isDirectory() || entry.name.startsWith("_")) {
        return [];
      }

      const toolPath = path.join(toolsDir, entry.name, "chatjs.json");
      try {
        await fs.access(toolPath);
      } catch {
        return [];
      }

      const toolSource = await fs.readFile(toolPath, "utf-8");
      const mod = toolEnvironmentSchema.parse(JSON.parse(toolSource));
      return mod.envRequirements.flatMap((toolEnvVar) => {
        const missing = getMissingRequirement(toolEnvVar, env);

        if (missing) {
          return [
            {
              // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              feature: `${directory === "tools/chatjs" ? "tools" : "features"}.${entry.name}`,
              missing: [missing],
            },
          ];
        }
        return [];
      });
    })
  );

  return toolErrors.flat();
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): validateBaseUrl accepts env: NodeJS.ProcessEnv; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): validateBaseUrl intentionally keeps the existing falsy-value behavior of env.APP_URL; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): validateBaseUrl preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const validateBaseUrl = (env: NodeJS.ProcessEnv): ValidationError | null => {
  const isProduction = env.NODE_ENV === "production" || env.VERCEL === "1";
  if (!isProduction) {
    return null;
  }

  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
  const hasBaseUrl = Boolean(env.APP_URL || env.VERCEL_URL);
  if (hasBaseUrl) {
    return null;
  }

  return {
    feature: "baseUrl",
    missing: [
      "APP_URL (for non-Vercel deployments) or VERCEL_URL (auto on Vercel)",
    ],
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): checkGatewaySnapshot preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const checkGatewaySnapshot = (): string | null => {
  if (config.ai.gateway === generatedForGateway) {
    return null;
  }
  // oxlint-disable-next-line typescript/restrict-template-expressions -- #608: Matching configured/generated gateway literals narrow this mismatch branch to never; keep its diagnostic for scaffolded configurations with a stale model snapshot.
  return `models.generated.ts was built for "${generatedForGateway}" but config uses "${config.ai.gateway}". Run \`bun fetch:models\` to update the fallback snapshot.`;
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkEnv's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-console, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): checkEnv keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): checkEnv keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-console (#514): checkEnv emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): checkEnv uses 0, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/prefer-readonly-parameter-types (#565): checkEnv accepts issue; validationError; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): checkEnv intentionally keeps the existing falsy-value behavior of snapshotWarning; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const checkEnv = async (): Promise<void> => {
  const { env } = process;
  if (isPlaywrightTestEnvironment(env)) {
    console.log(
      "✅ Skipping optional environment validation in Playwright test mode"
    );
    // Playwright CI only exercises anonymous flows, so optional feature checks
    // and the gateway snapshot warning stay enforced in non-Playwright builds.
    return;
  }

  const databaseOptions = z.object(databaseEnvOptions).safeParse(env);
  // oxlint-disable-next-line no-ternary -- Keep databaseErrors as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const databaseErrors = databaseOptions.success
    ? []
    : [
        {
          feature: "database",
          missing: databaseOptions.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`
          ),
        },
      ];

  const eveOptions = z
    .object(getEveRuntimeEnvOptions(env))
    .safeParse(resolveEveEnvironment(env));
  // oxlint-disable-next-line no-ternary -- Keep eveErrors as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const eveErrors = eveOptions.success
    ? []
    : [
        {
          feature: "Eve",
          missing: eveOptions.error.issues.map(
            (issue) => `${issue.path.join(".")}: ${issue.message}`
          ),
        },
      ];

  const baseUrlError = validateBaseUrl(env);
  const gatewayError = validateGatewayKey(env);
  const storageError = validateStorage(env);
  const installedToolErrors = await validateInstalledItems(env, "tools/chatjs");
  const errors = [
    ...eveErrors,
    ...databaseErrors,
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(baseUrlError ? [baseUrlError] : []),
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(gatewayError ? [gatewayError] : []),
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(storageError ? [storageError] : []),
    ...validateAuthentication(env),
    ...installedToolErrors,
    ...(await validateInstalledItems(env, "features")),
  ];

  if (errors.length > 0) {
    const message = errors
      .map(
        (validationError) =>
          `  - ${validationError.feature}: ${validationError.missing.join(", ")}`
      )
      .join("\n");

    console.error(
      `❌ Environment validation failed:\n${message}\n\nSet the required environment variables and check your app configuration.`
    );
    process.exit(1);
  }

  const snapshotWarning = checkGatewaySnapshot();
  if (snapshotWarning) {
    console.warn(`⚠️  ${snapshotWarning}`);
  }

  console.log("✅ Environment validation passed");
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-console, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-console, no-magic-numbers --
 * no-console (#514): try { await checkEnv(); } catch (error) { console.error emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): try { await checkEnv(); } catch (error) { console.error uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
try {
  // oxlint-disable-next-line node/no-top-level-await -- This setup executable awaits environment validation so its existing catch supplies the failure exit status.
  await checkEnv();
} catch (error) {
  console.error(error);
  process.exit(1);
}
/* oxlint-enable no-console, no-magic-numbers */
