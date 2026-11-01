import { databaseEnvOptions } from "./db/connection";

import { getEveRuntimeEnvOptions } from "./env-runtime-options";

import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
import { resolveEveEnvironment } from "./eve/environment";
import { z } from "zod";

const isPlaywrightTestEnvironmentEnabled = isPlaywrightTestEnvironment(
  process.env
);

const eveRuntimeEnvOptions = getEveRuntimeEnvOptions();

const clientEnvSchema = {
  NEXT_PUBLIC_REACT_QUERY_DEVTOOLS: z.enum(["0", "1"]).optional(),
  NEXT_PUBLIC_REACT_SCAN: z.enum(["0", "1"]).optional(),
};

const playwrightDefault = (value: unknown, fallback: string): unknown => {
  if (
    isPlaywrightTestEnvironmentEnabled &&
    (value === null || value === undefined || value === "")
  ) {
    return fallback;
  }
  return value;
};

const MIN_NONEMPTY_ENV_VALUE_LENGTH = 1;

/**
 * Server environment variable schemas with descriptions.
 *
 * Core variables only. Installed integrations own their environment readers;
 * their manifests feed the CLI checklist and the joint check-env command.
 * Exported separately so callers can inspect schemas without createEnv validation.
 */
const serverEnvSchema = {
  CHATJS_SANDBOX_DEV_RUN_ID: z.uuid().optional(),
  APP_URL: z
    .url()
    .optional()
    .describe(
      "App URL for non-Vercel deployments (full URL including https://)"
    ),
  AUTH_GITHUB_ID: z.string().optional().describe("GitHub OAuth app client ID"),
  AUTH_GITHUB_SECRET: z
    .string()
    .optional()
    .describe("GitHub OAuth app client secret"),
  // Authentication providers (enable in chat.config.ts)
  AUTH_GOOGLE_ID: z.string().optional().describe("Google OAuth client ID"),
  AUTH_GOOGLE_SECRET: z
    .string()
    .optional()
    .describe("Google OAuth client secret"),
  AUTH_SECRET: z
    .preprocess((value) => {
      if (
        isPlaywrightTestEnvironmentEnabled &&
        (value === null || value === undefined || value === "")
      ) {
        return "playwright-test-auth-secret";
      }
      return value;
    }, z.string().min(MIN_NONEMPTY_ENV_VALUE_LENGTH))
    .describe("NextAuth.js secret for signing session tokens"),
  // Optional cleanup cron job secret
  CRON_SECRET: z
    .string()
    .optional()
    .describe("Secret for cleanup cron job endpoint"),
  ...databaseEnvOptions,
  // Required core
  DATABASE_URL: z
    .preprocess((value) => {
      if (
        isPlaywrightTestEnvironmentEnabled &&
        (value === null || value === undefined || value === "")
      ) {
        return "postgres://postgres:postgres@127.0.0.1:5432/playwright";
      }
      return value;
    }, z.string().min(MIN_NONEMPTY_ENV_VALUE_LENGTH))
    .describe("Postgres connection string"),
  EVE_GATEWAY_SECRET: z.preprocess(
    (value) => playwrightDefault(value, "playwright-test-eve-gateway-secret"),
    eveRuntimeEnvOptions.EVE_GATEWAY_SECRET
  ),
  EVE_INTERNAL_ORIGIN: z.preprocess(
    (value) =>
      playwrightDefault(
        value,
        resolveEveEnvironment({
          PLAYWRIGHT_TEST_BASE_URL: process.env.PLAYWRIGHT_TEST_BASE_URL,
          PORT: process.env.PORT,
        }).EVE_INTERNAL_ORIGIN
      ),
    eveRuntimeEnvOptions.EVE_INTERNAL_ORIGIN
  ),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  VERCEL: z.string().optional(),
  VERCEL_APP_CLIENT_ID: z
    .string()
    .optional()
    .describe("Vercel OAuth integration client ID"),
  VERCEL_APP_CLIENT_SECRET: z
    .string()
    .optional()
    .describe("Vercel OAuth integration client secret"),
  VERCEL_AUTOMATION_BYPASS_SECRET: z
    .string()
    .optional()
    .describe(
      "Server-only credential for this project's protected Vercel deployments"
    ),
  VERCEL_BRANCH_URL: z
    .string()
    .optional()
    .describe("Stable Vercel branch hostname"),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  VERCEL_URL: z.string().optional().describe("Auto-set by Vercel platform"),
  WORKFLOW_POSTGRES_URL: z.preprocess(
    (value) =>
      playwrightDefault(
        value,
        "postgres://postgres:postgres@127.0.0.1:5432/playwright-eve"
      ),
    eveRuntimeEnvOptions.WORKFLOW_POSTGRES_URL
  ),
};
export { clientEnvSchema, serverEnvSchema };
export { getEveRuntimeEnvOptions } from "./env-runtime-options";
