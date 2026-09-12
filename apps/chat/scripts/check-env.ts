#!/usr/bin/env bun
/**
 * Build-time config validation script.
 * Validates that enabled features in config have their required env vars.
 * Run via `bun run check-env` or automatically in prebuild.
 */
import fs from "node:fs/promises";
import path from "node:path";

import { config as loadEnvConfig } from "dotenv";
import { z } from "zod";

import { gatewayEnvRequirements } from "../lib/ai/gateway-model-defaults";
import { generatedForGateway } from "../lib/ai/models.generated";
import { config } from "../lib/config";
import {
  aiToolEnvRequirements,
  authEnvRequirements,
  getMissingRequirement,
  isRequirementSatisfied,
} from "../lib/config-requirements";
import { databaseEnvOptions } from "../lib/db/connection";
import { isPlaywrightTestEnvironment } from "../lib/playwright-test-environment";
import { redisEnvOptions } from "../lib/redis/connection";
import { storageEnvRequirements, storageId } from "../lib/storage-options";

loadEnvConfig({ path: ".env.local" });
loadEnvConfig();

interface ValidationError {
  feature: string;
  missing: string[];
}

const projectRoot = path.resolve(import.meta.dirname, "..");
const toolEnvironmentSchema = z.object({
  envRequirements: z
    .array(
      z.object({
        description: z.string().optional(),
        options: z.array(z.array(z.string()).min(1)).min(1),
      })
    )
    .default([]),
});

const validateGatewayKey = (env: NodeJS.ProcessEnv): ValidationError | null => {
  const gateway: string = config.ai.gateway;
  const missing = gatewayEnvRequirements
    .map((requirement) => getMissingRequirement(requirement, env))
    .filter((value) => value !== null);
  if (!missing.length) {
    return null;
  }
  return {
    feature: `aiGateway (${gateway})`,
    missing,
  };
};

const validateStorage = (env: NodeJS.ProcessEnv): ValidationError | null => {
  if (
    !(
      config.features.attachments ||
      config.ai.tools.image.enabled ||
      config.ai.tools.video.enabled
    )
  ) {
    return null;
  }
  const missing = storageEnvRequirements
    .map((requirement) => getMissingRequirement(requirement, env))
    .filter((value) => value !== null);
  return missing.length
    ? { feature: `fileStorage (${storageId})`, missing }
    : null;
};

const validateAiTools = (env: NodeJS.ProcessEnv): ValidationError[] => {
  const errors: ValidationError[] = [];

  const toolEntries = Object.entries(aiToolEnvRequirements) as [
    keyof typeof aiToolEnvRequirements,
    NonNullable<
      (typeof aiToolEnvRequirements)[keyof typeof aiToolEnvRequirements]
    >,
  ][];

  for (const [tool, requirement] of toolEntries) {
    const toolConfig = config.ai.tools[tool];
    if (!(requirement && "enabled" in toolConfig && toolConfig.enabled)) {
      continue;
    }
    const missing = getMissingRequirement(requirement, env);
    if (missing) {
      errors.push({
        feature: `ai.tools.${tool}`,
        missing: [missing],
      });
    }
  }

  return errors;
};

const validateAuthentication = (env: NodeJS.ProcessEnv): ValidationError[] => {
  const errors: ValidationError[] = [];

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

const validateInstalledTools = async (
  env: NodeJS.ProcessEnv
): Promise<ValidationError[]> => {
  const toolsDir = path.join(projectRoot, "tools/chatjs");
  const entries = await fs
    .readdir(toolsDir, { withFileTypes: true })
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    });
  const errors: ValidationError[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) {
      continue;
    }

    const toolPath = path.join(toolsDir, entry.name, "chatjs.json");
    const exists = await fs
      .access(toolPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      continue;
    }

    const toolSource = await fs.readFile(toolPath, "utf-8");
    const mod = toolEnvironmentSchema.parse(JSON.parse(toolSource));

    for (const toolEnvVar of mod.envRequirements) {
      const missing = getMissingRequirement(toolEnvVar, env);
      if (missing) {
        errors.push({
          feature: `tools.${entry.name}`,
          missing: [missing],
        });
      }
    }
  }

  return errors;
};

const validateBaseUrl = (env: NodeJS.ProcessEnv): ValidationError | null => {
  const isProduction = env.NODE_ENV === "production" || env.VERCEL === "1";
  if (!isProduction) {
    return null;
  }

  const hasBaseUrl = !!(env.APP_URL || env.VERCEL_URL);
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

const checkGatewaySnapshot = (): string | null => {
  if (config.ai.gateway === generatedForGateway) {
    return null;
  }
  return `models.generated.ts was built for "${generatedForGateway}" but config uses "${config.ai.gateway}". Run \`bun fetch:models\` to update the fallback snapshot.`;
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

  const databaseOptions = z.object(databaseEnvOptions).safeParse(env);
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

  const redisOptions = z.object(redisEnvOptions).safeParse(env);
  const redisErrors = redisOptions.success
    ? []
    : [
        {
          feature: "Redis",
          missing: ["REDIS_URL must be a redis:// or rediss:// connection URL"],
        },
      ];
  const baseUrlError = validateBaseUrl(env);
  const gatewayError = validateGatewayKey(env);
  const storageError = validateStorage(env);
  const installedToolErrors = await validateInstalledTools(env);
  const errors = [
    ...databaseErrors,
    ...redisErrors,
    ...(baseUrlError ? [baseUrlError] : []),
    ...(gatewayError ? [gatewayError] : []),
    ...(storageError ? [storageError] : []),
    ...validateAiTools(env),
    ...validateAuthentication(env),
    ...installedToolErrors,
  ];

  if (errors.length > 0) {
    const message = errors
      .map((e) => `  - ${e.feature}: ${e.missing.join(", ")}`)
      .join("\n");

    console.error(
      `❌ Environment validation failed:\n${message}\n\nEither set the env vars or disable the feature in chat.config.ts`
    );
    process.exit(1);
  }

  const snapshotWarning = checkGatewaySnapshot();
  if (snapshotWarning) {
    console.warn(`⚠️  ${snapshotWarning}`);
  }

  console.log("✅ Environment validation passed");
};

try {
  await checkEnv();
} catch (error) {
  console.error(error);
  process.exit(1);
}
