import { databaseEnvOptions } from "./db/connection";

import { getEveRuntimeEnvOptions } from "./env-runtime-options";

import { isPlaywrightTestEnvironment } from "@/lib/playwright-test-environment";
import { resolveEveEnvironment } from "./eve/environment";
import { z } from "zod";

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): isPlaywrightTestEnvironmentEnabled reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
const isPlaywrightTestEnvironmentEnabled = isPlaywrightTestEnvironment(
  process.env
);
/* oxlint-enable node/no-process-env */

const eveRuntimeEnvOptions = getEveRuntimeEnvOptions();

const clientEnvSchema = {
  NEXT_PUBLIC_REACT_QUERY_DEVTOOLS: z.enum(["0", "1"]).optional(),
  NEXT_PUBLIC_REACT_SCAN: z.enum(["0", "1"]).optional(),
};

/* oxlint-disable no-undefined --
 * no-undefined (#519): playwrightDefault uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
const playwrightDefault = (value: unknown, fallback: string): unknown => {
  if (
    isPlaywrightTestEnvironmentEnabled &&
    (value === null || value === undefined || value === "")
  ) {
    return fallback;
  }
  return value;
};
/* oxlint-enable no-undefined */

const MIN_NONEMPTY_ENV_VALUE_LENGTH = 1;
const MCP_ENCRYPTION_KEY_LENGTH = 44;

/* oxlint-disable no-undefined, node/no-process-env --
no-undefined (#519): serverEnvSchema uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
node/no-process-env (#537): serverEnvSchema reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior. */
/**
 * Server environment variable schemas with descriptions.
 *
 * Descriptions are the single source of truth used by:
 * - The CLI env checklist (derived at build time)
 * - The .env.example comments
 *
 * Exported separately from `env.ts` so the CLI can import
 * without triggering `createEnv` runtime validation.
 */
const serverEnvSchema = {
  // AI Gateway keys (one required depending on config.ai.gateway)
  AI_GATEWAY_API_KEY: z
    .string()
    .optional()
    .describe("Vercel AI Gateway API key"),
  // Optional features (enable in chat.config.ts)
  // App URL (for non-Vercel deployments) - full URL including https://
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing databaseEnvOptions own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
  DAYTONA_API_KEY: z.string().optional(),
  DAYTONA_ORGANIZATION_ID: z.string().optional(),
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
  EXA_API_KEY: z.string().optional().describe("Exa API key for web search"),
  FIRECRAWL_API_KEY: z
    .string()
    .optional()
    .describe("Firecrawl API key for web search and URL retrieval"),
  LITELLM_API_KEY: z
    .string()
    .optional()
    .describe("LiteLLM proxy API key (master or virtual key)"),
  LITELLM_BASE_URL: z.url().optional().describe("LiteLLM proxy base URL"),
  MCP_ENCRYPTION_KEY: z
    .union([z.string().length(MCP_ENCRYPTION_KEY_LENGTH), z.literal("")])
    .optional()
    .describe("Encryption key for MCP server credentials (base64, 44 chars)"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  OPENAI_API_KEY: z.string().optional().describe("OpenAI API key"),
  OPENAI_COMPATIBLE_API_KEY: z
    .string()
    .optional()
    .describe("API key for OpenAI-compatible provider"),
  OPENAI_COMPATIBLE_BASE_URL: z
    .url()
    .optional()
    .describe("Base URL for OpenAI-compatible provider"),
  OPENROUTER_API_KEY: z.string().optional().describe("OpenRouter API key"),
  TAVILY_API_KEY: z
    .string()
    .optional()
    .describe("Tavily API key for web search"),
  TRUSTED_CLIENT_IP_HEADER: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/u)
    .optional()
    .describe(
      "Self-hosted reverse proxy header containing one verified client IP; the proxy must overwrite it"
    ),
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
  VERCEL_OIDC_TOKEN: z
    .string()
    .optional()
    .describe("Vercel OIDC token (auto-set on Vercel deployments)"),
  VERCEL_PROJECT_ID: z
    .string()
    .optional()
    .describe("Vercel project ID for sandbox (non-Vercel deployments)"),
  VERCEL_SANDBOX_RUNTIME: z
    .string()
    .min(MIN_NONEMPTY_ENV_VALUE_LENGTH)
    .optional()
    .describe("Legacy default Vercel sandbox runtime identifier for Python"),
  VERCEL_SANDBOX_RUNTIME_JAVASCRIPT: z
    .string()
    .min(MIN_NONEMPTY_ENV_VALUE_LENGTH)
    .optional()
    .describe("Vercel sandbox runtime identifier for JavaScript execution"),
  VERCEL_SANDBOX_RUNTIME_PYTHON: z
    .string()
    .min(MIN_NONEMPTY_ENV_VALUE_LENGTH)
    .optional()
    .describe("Vercel sandbox runtime identifier for Python execution"),
  // Sandbox (for non-Vercel deployments)
  VERCEL_TEAM_ID: z
    .string()
    .optional()
    .describe("Vercel team ID for sandbox (non-Vercel deployments)"),
  VERCEL_TOKEN: z
    .string()
    .optional()
    .describe("Vercel API token for sandbox (non-Vercel deployments)"),
  // Vercel platform (auto-set by Vercel)
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (clientEnvSchema, getEveRuntimeEnvOptions, serverEnvSchema); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-undefined, node/no-process-env */
export { clientEnvSchema, serverEnvSchema };
export { getEveRuntimeEnvOptions } from "./env-runtime-options";
/* oxlint-enable import/no-named-export */
