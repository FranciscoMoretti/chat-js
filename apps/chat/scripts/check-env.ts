#!/usr/bin/env bun
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
import {
  storageEnvRequirements,
  storageId,
} from "@/chatjs/providers/storage-options";

import { config } from "@/lib/config";
import { databaseEnvOptions } from "@/lib/db/connection";
import fs from "node:fs/promises";
import { gatewayEnvRequirements } from "@/chatjs/providers/gateway-defaults";
import { generatedForGateway } from "@/lib/ai/models.generated";
import { getEveRuntimeEnvOptions } from "@/lib/env-schema";
import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
import { config as loadEnvConfig } from "dotenv";
import path from "node:path";
import { resolveEveEnvironment } from "@/lib/eve/environment";
import { z } from "zod";
import { validatePluginEnvironment } from "./installed-environment-validation";

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
  requiresStorage: z.literal(true).optional(),
  files: z.array(z.string()).default([]),
});

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

const readInstalledItems = async (
  directory: "chatjs/tools" | "chatjs/plugins"
) => {
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
  const items = await Promise.all(
    entries.map(async (entry: Readonly<(typeof entries)[number]>) => {
      if (!entry.isDirectory() || entry.name.startsWith("_")) {
        return [];
      }

      const toolPath = path.join(
        toolsDir,
        entry.name,
        directory === "chatjs/plugins" ? "plugin.json" : "chatjs.json"
      );
      try {
        await fs.access(toolPath);
      } catch {
        return [];
      }

      const toolSource = await fs.readFile(toolPath, "utf-8");
      const descriptor: unknown = JSON.parse(toolSource);
      return [
        {
          name: entry.name,
          directory,
          definition: toolEnvironmentSchema.parse(descriptor),
        },
      ];
    })
  );
  return items.flat();
};

const validateInstalledItem = async (
  {
    name,
    directory,
    definition,
  }: Awaited<ReturnType<typeof readInstalledItems>>[number],
  env: Readonly<NodeJS.ProcessEnv>
): Promise<ValidationError[]> => {
  const missingRequirements = definition.envRequirements.flatMap(
    (toolEnvVar: RequirementInput) => {
      const missing = getMissingRequirement(toolEnvVar, env);

      if (typeof missing !== "string" || missing === "") {
        return [];
      }
      return [
        {
          feature: `${directory === "chatjs/tools" ? "tools" : "plugins"}.${name}`,
          missing: [missing],
        },
      ];
    }
  );
  if (missingRequirements.length > 0 || directory === "chatjs/tools") {
    return missingRequirements;
  }
  const invalid = await validatePluginEnvironment(
    path.join(projectRoot, directory, name),
    definition.files,
    env
  );
  return invalid.length > 0
    ? [
        {
          feature: `plugins.${name}`,
          missing: invalid,
        },
      ]
    : [];
};

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
  return [
    ...eveErrors,
    ...databaseErrors,
    ...(baseUrlError ? [baseUrlError] : []),
    ...(gatewayError ? [gatewayError] : []),
  ];
};

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

  const configuredErrors = validateConfiguredEnvironment(env);
  const groups = await Promise.all([
    readInstalledItems("chatjs/tools"),
    readInstalledItems("chatjs/plugins"),
  ]);
  const items = groups.flat();
  const storageError = items.some(
    ({ definition }) => definition.requiresStorage === true
  )
    ? validateStorage(env)
    : null;
  const itemErrors = await Promise.all(
    items.map(async (item) => await validateInstalledItem(item, env))
  );
  const errors = [
    ...configuredErrors,
    ...validateAuthentication(env),
    ...(storageError ? [storageError] : []),
    ...itemErrors.flat(),
  ];

  if (reportEnvironmentFailure(errors)) {
    process.exit(VALIDATION_FAILURE_EXIT_STATUS);
  }
  reportEnvironmentSuccess(checkGatewaySnapshot());
};

try {
  await checkEnv();
} catch (error) {
  console.error(error);
  process.exit(VALIDATION_FAILURE_EXIT_STATUS);
}
