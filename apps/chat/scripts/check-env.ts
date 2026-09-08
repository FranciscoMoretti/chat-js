#!/usr/bin/env bun
/**
 * Build-time config validation script.
 * Validates that enabled features in config have their required env vars.
 * Run via `bun run check-env` or automatically in prebuild.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnvConfig } from "dotenv";
import { getProvider } from "files-sdk/providers";
// biome-ignore lint/performance/noNamespaceImport: TypeScript API requires namespace import due to extensive usage
import * as ts from "typescript";
import { gatewayEnvRequirements } from "../lib/ai/gateway-model-defaults";
import { generatedForGateway } from "../lib/ai/models.generated";
import { config } from "../lib/config";
import {
  aiToolEnvRequirements,
  authEnvRequirements,
  getMissingRequirement,
  isRequirementSatisfied,
} from "../lib/config-requirements";
import { isPlaywrightTestEnvironment } from "../lib/playwright-test-environment";
import { storageProvider } from "../lib/storage-provider";
import {
  getStorageEnvironmentRequirements,
  type StorageEnvironmentVariable,
} from "../lib/storage-provider-metadata";

loadEnvConfig({ path: ".env.local" });
loadEnvConfig();

interface ValidationError {
  feature: string;
  missing: string[];
}

type StaticToolEnvVar = {
  description?: string;
  options: string[][];
};

type StaticToolEnvVars = StaticToolEnvVar[];

type StaticToolMetadata = {
  toolEnvVars: StaticToolEnvVars;
};

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function unwrapExpression(node: ts.Expression): ts.Expression {
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return unwrapExpression(node.expression);
  }
  return node;
}

function readString(node: ts.Expression): string | null {
  const expr = unwrapExpression(node);
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  return null;
}

function readStringArray(node: ts.Expression): string[] | null {
  const expr = unwrapExpression(node);
  if (!ts.isArrayLiteralExpression(expr)) {
    return null;
  }

  const values: string[] = [];
  for (const element of expr.elements) {
    if (!ts.isExpression(element)) {
      return null;
    }
    const value = readString(element);
    if (value === null) {
      return null;
    }
    values.push(value);
  }

  return values;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: AST traversal logic is inherently complex
function readToolEnvVar(node: ts.Expression): StaticToolEnvVar | null {
  const expr = unwrapExpression(node);
  if (!ts.isObjectLiteralExpression(expr)) {
    return null;
  }

  let description: string | null = null;
  let options: string[][] | null = null;

  for (const property of expr.properties) {
    if (!ts.isPropertyAssignment(property)) {
      return null;
    }

    const nameNode = property.name;
    const name =
      ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)
        ? nameNode.text
        : null;

    if (name === "description") {
      description = readString(property.initializer);
    } else if (name === "options") {
      const outer = unwrapExpression(property.initializer);
      if (!ts.isArrayLiteralExpression(outer)) {
        return null;
      }

      const groups: string[][] = [];
      for (const element of outer.elements) {
        if (!ts.isExpression(element)) {
          return null;
        }
        const group = readStringArray(element);
        if (group === null) {
          return null;
        }
        groups.push(group);
      }
      options = groups;
    }
  }

  return options ? { ...(description ? { description } : {}), options } : null;
}

function readToolEnvVars(node: ts.Expression): StaticToolEnvVars {
  const expr = unwrapExpression(node);
  if (!ts.isArrayLiteralExpression(expr)) {
    return [];
  }

  const toolEnvVars: StaticToolEnvVars = [];
  for (const element of expr.elements) {
    if (!ts.isExpression(element)) {
      return [];
    }
    const toolEnvVar = readToolEnvVar(element);
    if (!toolEnvVar) {
      return [];
    }
    toolEnvVars.push(toolEnvVar);
  }

  return toolEnvVars;
}

function readStaticToolMetadata(sourceText: string): StaticToolMetadata {
  const sourceFile = ts.createSourceFile(
    "tool.ts",
    sourceText,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );
  const toolEnvVars: StaticToolEnvVars = [];

  function visit(node: ts.Node): void {
    if (
      ts.isVariableStatement(node) &&
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      for (const declaration of node.declarationList.declarations) {
        if (declaration.name.getText() !== "toolEnvVars") {
          continue;
        }
        const initializer = declaration.initializer;
        if (initializer && ts.isExpression(initializer)) {
          toolEnvVars.push(...readToolEnvVars(initializer));
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    toolEnvVars,
  };
}

function resolveToolsDir(toolsPath: string): string {
  if (toolsPath.startsWith("@/")) {
    return path.resolve(projectRoot, toolsPath.slice(2));
  }

  if (toolsPath.startsWith("./") || toolsPath.startsWith("../")) {
    return path.resolve(projectRoot, toolsPath);
  }

  if (path.isAbsolute(toolsPath)) {
    return toolsPath;
  }

  return path.resolve(projectRoot, toolsPath);
}

function validateGatewayKey(env: NodeJS.ProcessEnv): ValidationError | null {
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
}

function hasStorageEnvVariable(
  variable: StorageEnvironmentVariable,
  env: NodeJS.ProcessEnv
) {
  return [variable.key, ...(variable.aliases ?? [])].some((key) => !!env[key]);
}

function validateStorage(env: NodeJS.ProcessEnv): ValidationError | null {
  const enabled =
    config.features.attachments ||
    config.ai.tools.image.enabled ||
    config.ai.tools.video.enabled;
  if (!enabled) {
    return null;
  }

  const metadata = getProvider(storageProvider.slug);
  if (!metadata) {
    return {
      feature: "fileStorage",
      missing: [`Unknown Files SDK provider: ${storageProvider.slug}`],
    };
  }

  try {
    storageProvider.createAdapter();
  } catch (error) {
    return {
      feature: `fileStorage (${metadata.name})`,
      missing: [
        error instanceof Error ? error.message : "Invalid adapter options",
      ],
    };
  }

  const missing = getStorageEnvironmentRequirements(
    storageProvider.slug,
    storageProvider.options
  )
    .filter(
      (requirement) =>
        !requirement.options.some((option) =>
          option.every((variable) => hasStorageEnvVariable(variable, env))
        )
    )
    .map((requirement) =>
      requirement.options
        .map((option) => option.map(({ key }) => key).join(" + "))
        .join(" or ")
    );

  return missing.length > 0
    ? { feature: `fileStorage (${metadata.name})`, missing }
    : null;
}

function validateAiTools(env: NodeJS.ProcessEnv): ValidationError[] {
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
}

function validateAuthentication(env: NodeJS.ProcessEnv): ValidationError[] {
  const errors: ValidationError[] = [];

  const authKeys = Object.keys(authEnvRequirements) as Array<
    keyof typeof authEnvRequirements
  >;
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
}

async function validateInstalledTools(
  env: NodeJS.ProcessEnv
): Promise<ValidationError[]> {
  const toolsDir = resolveToolsDir(config.paths.tools);
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

    const toolPath = path.join(toolsDir, entry.name, "tool.ts");
    const exists = await fs
      .access(toolPath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      continue;
    }

    const toolSource = await fs.readFile(toolPath, "utf8");
    const mod = readStaticToolMetadata(toolSource);

    for (const toolEnvVar of mod.toolEnvVars) {
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
}

function validateBaseUrl(env: NodeJS.ProcessEnv): ValidationError | null {
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
}

function checkGatewaySnapshot(): string | null {
  if (config.ai.gateway === generatedForGateway) {
    return null;
  }
  return `models.generated.ts was built for "${generatedForGateway}" but config uses "${config.ai.gateway}". Run \`bun fetch:models\` to update the fallback snapshot.`;
}

async function checkEnv(): Promise<void> {
  const env = process.env;
  if (isPlaywrightTestEnvironment(env)) {
    console.log(
      "✅ Skipping optional environment validation in Playwright test mode"
    );
    // Playwright CI only exercises anonymous flows, so optional feature checks
    // and the gateway snapshot warning stay enforced in non-Playwright builds.
    return;
  }

  const baseUrlError = validateBaseUrl(env);
  const gatewayError = validateGatewayKey(env);
  const storageError = validateStorage(env);
  const installedToolErrors = await validateInstalledTools(env);
  const eveMissing =
    env.EVE_ENABLED === "true"
      ? [
          "EVE_INTERNAL_ORIGIN",
          "EVE_GATEWAY_SECRET",
          "WORKFLOW_POSTGRES_URL",
        ].filter((name) => !env[name])
      : [];
  const errors = [
    ...(eveMissing.length ? [{ feature: "Eve", missing: eveMissing }] : []),
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
}

checkEnv().catch((error) => {
  console.error(error);
  process.exit(1);
});
