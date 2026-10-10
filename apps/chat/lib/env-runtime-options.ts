import { isWorkflowTransactionPooler } from "./eve/environment";

import { resolveWorkflowWorld } from "./eve/world-config";
import { z } from "zod";

const httpUrl = z.url().refine(
  (value) => {
    if (!URL.canParse(value)) {
      return false;
    }
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  },
  { message: "Must use an http:// or https:// URL" }
);
const ipv4Loopback = /^127\.\d+\.\d+\.\d+$/u;
const postgresUrl = z.url().refine(
  (value) => {
    if (!URL.canParse(value)) {
      return false;
    }
    const { protocol } = new URL(value);
    return protocol === "postgres:" || protocol === "postgresql:";
  },
  { message: "Must use a postgres:// or postgresql:// URL" }
);

const EVE_GATEWAY_SECRET_MIN_LENGTH = 32;
const ROOT_PATHNAME = "/";
interface EveRuntimeEnvironment {
  readonly VERCEL?: string;
  readonly VERCEL_ENV?: string;
  readonly NODE_ENV?: string;
}
const createEveInternalOriginSchema = (): z.ZodURL =>
  httpUrl
    .refine(
      (value) => {
        if (!URL.canParse(value)) {
          return false;
        }
        const { protocol, hostname } = new URL(value);
        return (
          protocol === "https:" ||
          (protocol === "http:" &&
            (hostname === "localhost" ||
              hostname === "[::1]" ||
              ipv4Loopback.test(hostname)))
        );
      },
      {
        message: "EVE_INTERNAL_ORIGIN must use HTTPS, or HTTP on loopback only",
      }
    )
    .refine(
      (value) => {
        if (!URL.canParse(value)) {
          return false;
        }
        const url = new URL(value);
        return (
          url.pathname === ROOT_PATHNAME &&
          !url.search &&
          !url.hash &&
          !url.username &&
          !url.password
        );
      },
      {
        message:
          "EVE_INTERNAL_ORIGIN must be an origin without a path, query, or credentials",
      }
    )
    .describe(
      "Optional application gateway origin serving /eve/chat/v1; defaults to the current deployment or local app"
    );

const createWorkflowPostgresUrlSchema = (
  environment: EveRuntimeEnvironment
): z.ZodOptional<z.ZodString> | z.ZodURL =>
  // oxlint-disable-next-line no-ternary -- Keep WORKFLOW_POSTGRES_URL as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  resolveWorkflowWorld(environment) === "vercel"
    ? z
        .string()
        .optional()
        .describe("Unused on Vercel; local/self-hosted workflows only")
    : postgresUrl
        .refine(
          (value) => {
            try {
              return !isWorkflowTransactionPooler(value);
            } catch {
              return false;
            }
          },
          {
            message:
              "EVE needs a direct or session PostgreSQL connection; set WORKFLOW_POSTGRES_URL to a runtime connection instead of a transaction pooler",
          }
        )
        .describe(
          "Local/self-hosted workflow database override; defaults to DATABASE_URL. Unused on Vercel"
        );

const getEveRuntimeEnvOptions = (
  /* oxlint-disable-next-line node/no-process-env -- Snapshot process.env when the environment schema module initializes, matching the prior configuration boundary. */
  environment: EveRuntimeEnvironment = process.env
): {
  EVE_GATEWAY_SECRET: z.ZodString;
  EVE_INTERNAL_ORIGIN: z.ZodURL;
  WORKFLOW_POSTGRES_URL: z.ZodOptional<z.ZodString> | z.ZodURL;
} => ({
  EVE_GATEWAY_SECRET: z
    .string()
    .min(EVE_GATEWAY_SECRET_MIN_LENGTH)
    .describe(
      "Required independent EVE gateway secret; generate with openssl rand -base64 32"
    ),
  EVE_INTERNAL_ORIGIN: createEveInternalOriginSchema(),
  WORKFLOW_POSTGRES_URL: createWorkflowPostgresUrlSchema(environment),
});

/* oxlint-disable import/no-named-export, import/prefer-default-export -- Keep the established named helper binding consumed by env-schema. */
export { getEveRuntimeEnvOptions };
/* oxlint-enable import/no-named-export, import/prefer-default-export */
