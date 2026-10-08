#!/usr/bin/env bun
/* oxlint-disable import/max-dependencies, import/no-nodejs-modules --
 * import/max-dependencies (#524): This command explicitly inspects installed integrations and their environment requirements; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This server/tooling module uses Node fs and path APIs to read installed files and resolve the application root.
 */
/**
 * Build-time config validation script.
 * Validates environment requirements for installed integrations.
 * Run via `bun run check-env` or automatically in prebuild.
 */
import {
  authEnvRequirements,
  getMissingRequirement,
  isRequirementSatisfied,
} from "@/lib/config-requirements";
import {
  formatGatewaySnapshotWarning,
  reportEnvironmentFailure,
  reportEnvironmentSuccess,
} from "./environment-validation-report";
import { storageEnvRequirements, storageId } from "@/lib/storage-options";

import { config } from "@/lib/config";
import { databaseEnvOptions } from "@/lib/db/connection";
import fs from "node:fs/promises";
import { gatewayEnvRequirements } from "@/lib/ai/gateway-model-defaults";
import { generatedForGateway } from "@/lib/ai/models.generated";
import { getEveRuntimeEnvOptions } from "@/lib/env-schema";
import { installedFeatures } from "@/features/installed";
import { installedToolNames } from "@/tools/chatjs/installed-features";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
import { config as loadEnvConfig } from "dotenv";
import path from "node:path";
import { resolveEveEnvironment } from "@/lib/eve/environment";
import { z } from "zod";
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules */

loadEnvConfig({ path: ".env.local" });
loadEnvConfig();

type RequirementInput = Parameters<typeof getMissingRequirement>["0"];

interface ValidationError {
  feature: string;
  missing: string[];
}

const VALIDATION_FAILURE_EXIT_STATUS = 1;
const MINIMUM_NONEMPTY_OPTION_COUNT = 1;
const EMPTY_MISSING_REQUIREMENT_COUNT = 0;

const projectRoot = path.resolve(import.meta.dirname, "..");
const nonEmptyEnvironmentOptionSchema = z
  .array(z.string())
  .min(MINIMUM_NONEMPTY_OPTION_COUNT);
const toolEnvironmentRequirementSchema = z.object({
  description: z.string().optional(),
  options: z
    .array(nonEmptyEnvironmentOptionSchema)
    .min(MINIMUM_NONEMPTY_OPTION_COUNT),
  runtimeAuth: z.literal("vercel-oidc").optional(),
});
const toolEnvironmentSchema = z.object({
  envRequirements: z.array(toolEnvironmentRequirementSchema).default([]),
});

/* oxlint-disable unicorn/no-null -- Keep null as the explicit no-error result used by the caller's conditional spread. */
const validateGatewayKey = (
  env: Readonly<NodeJS.ProcessEnv>
): ValidationError | null => {
  const gateway: string = config.ai.gateway;
  const missing = gatewayEnvRequirements
    .map((requirement: RequirementInput) =>
      getMissingRequirement(requirement, env)
    )
    .filter((value) => value !== null);
  if (missing.length === EMPTY_MISSING_REQUIREMENT_COUNT) {
    return null;
  }
  return {
    feature: `aiGateway (${gateway})`,
    missing,
  };
};

const validateStorage = (
  env: Readonly<NodeJS.ProcessEnv>
): ValidationError | null => {
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
    .map((requirement: RequirementInput) =>
      getMissingRequirement(requirement, env)
    )
    .filter((value) => value !== null);

  if (missing.length > EMPTY_MISSING_REQUIREMENT_COUNT) {
    return { feature: `fileStorage (${storageId})`, missing };
  }
  return null;
};
/* oxlint-enable unicorn/no-null */

const validateAuthentication = (
  env: Readonly<NodeJS.ProcessEnv>
): ValidationError[] => {
  const authKeys = Object.keys(authEnvRequirements).filter(
    (key): key is keyof typeof authEnvRequirements =>
      Object.hasOwn(authEnvRequirements, key)
  );
  const errors = authKeys.flatMap((provider): ValidationError[] => {
    if (!config.authentication[provider]) {
      return [];
    }
    const requirement = authEnvRequirements[provider];
    const missing = getMissingRequirement(requirement, env);
    if (typeof missing === "string" && missing !== "") {
      return [{ feature: `authentication.${provider}`, missing: [missing] }];
    }
    return [];
  });

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

const validateInstalledItems = async (
  env: Readonly<NodeJS.ProcessEnv>,
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
    entries.map(async (entry: Readonly<(typeof entries)[number]>) => {
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
      return mod.envRequirements.flatMap((toolEnvVar: RequirementInput) => {
        const missing = getMissingRequirement(toolEnvVar, env);

        if (typeof missing !== "string" || missing === "") {
          return [];
        }
        return [
          {
            // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            feature: `${directory === "tools/chatjs" ? "tools" : "features"}.${entry.name}`,
            missing: [missing],
          },
        ];
      });
    })
  );

  return toolErrors.flat();
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable unicorn/no-null -- Keep null as the explicit no-error result used by the caller's conditional spread. */
const validateBaseUrl = (
  env: Readonly<NodeJS.ProcessEnv>
): ValidationError | null => {
  const isProduction = env.NODE_ENV === "production" || env.VERCEL === "1";
  if (!isProduction || Boolean(env.APP_URL) || Boolean(env.VERCEL_URL)) {
    return null;
  }
  return {
    feature: "baseUrl",
    missing: [
      "APP_URL (for non-Vercel deployments) or VERCEL_URL (auto on Vercel)",
    ],
  };
};

const checkGatewaySnapshot = (): string | null => {
  const configuredGateway: string = config.ai.gateway;
  if (configuredGateway !== generatedForGateway) {
    return formatGatewaySnapshotWarning(generatedForGateway, configuredGateway);
  }
  return null;
};
/* oxlint-enable unicorn/no-null */

const validateDatabaseEnvironment = (
  env: Readonly<NodeJS.ProcessEnv>
): ValidationError[] => {
  const databaseOptions = z.object(databaseEnvOptions).safeParse(env);
  if (databaseOptions.success) {
    return [];
  }
  return [
    {
      feature: "database",
      missing: databaseOptions.error.issues.map(
        (issue: {
          readonly path: readonly PropertyKey[];
          readonly message: string;
        }) => `${issue.path.join(".")}: ${issue.message}`
      ),
    },
  ];
};

const validateEveEnvironment = (
  env: Readonly<NodeJS.ProcessEnv>
): ValidationError[] => {
  const eveOptions = z
    .object(getEveRuntimeEnvOptions(env))
    .safeParse(resolveEveEnvironment(env));
  if (eveOptions.success) {
    return [];
  }
  return [
    {
      feature: "Eve",
      missing: eveOptions.error.issues.map(
        (issue: {
          readonly path: readonly PropertyKey[];
          readonly message: string;
        }) => `${issue.path.join(".")}: ${issue.message}`
      ),
    },
  ];
};

const validateConfiguredEnvironment = (
  env: Readonly<NodeJS.ProcessEnv>
): ValidationError[] => {
  const databaseErrors = validateDatabaseEnvironment(env);
  const eveErrors = validateEveEnvironment(env);
  const baseUrlError = validateBaseUrl(env);
  const gatewayError = validateGatewayKey(env);
  const storageError = validateStorage(env);
  return [
    ...eveErrors,
    ...databaseErrors,
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(baseUrlError ? [baseUrlError] : []),
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(gatewayError ? [gatewayError] : []),
    // oxlint-disable-next-line no-ternary -- Keep iterable spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    ...(storageError ? [storageError] : []),
  ];
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkEnv's awaited sequencing and rejected-Promise behavior. */
const checkEnv = async (): Promise<void> => {
  const { env } = process;
  if (isPlaywrightTestEnvironment(env)) {
    // oxlint-disable-next-line no-console -- This CLI reports its explicit Playwright validation bypass.
    console.log(
      "✅ Skipping optional environment validation in Playwright test mode"
    );
    // Playwright CI only exercises anonymous flows, so optional feature checks
    // and the gateway snapshot warning stay enforced in non-Playwright builds.
    return;
  }

  const configuredErrors = validateConfiguredEnvironment(env);
  const installedToolErrors = await validateInstalledItems(env, "tools/chatjs");
  const errors = [
    ...configuredErrors,
    ...validateAuthentication(env),
    ...installedToolErrors,
    ...(await validateInstalledItems(env, "features")),
  ];

  if (reportEnvironmentFailure(errors)) {
    process.exit(VALIDATION_FAILURE_EXIT_STATUS);
  }
  reportEnvironmentSuccess(checkGatewaySnapshot());
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable no-console -- This CLI reports unexpected setup exceptions through console.error. */
try {
  // oxlint-disable-next-line node/no-top-level-await -- This setup executable awaits environment validation so its existing catch supplies the failure exit status.
  await checkEnv();
} catch (error) {
  console.error(error);
  process.exit(VALIDATION_FAILURE_EXIT_STATUS);
}
/* oxlint-enable no-console */
