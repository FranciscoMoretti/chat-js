import { env } from "@/lib/env";

/* oxlint-disable jsdoc/require-returns, node/no-process-env, typescript/strict-boolean-expressions --
 * jsdoc/require-returns (#535): getBaseUrl's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * node/no-process-env (#537): getBaseUrl reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 * typescript/strict-boolean-expressions (#610): getBaseUrl intentionally keeps the existing falsy-value behavior of env.APP_URL; env.VERCEL_BRANCH_URL; env.VERCEL_URL; process.env.PORT; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * Returns the base URL for the application.
 * Priority: APP_URL > preview branch URL > VERCEL_URL > localhost
 */
export const getBaseUrl = (): string => {
  if (env.APP_URL) {
    return env.APP_URL;
  }
  if (env.VERCEL_ENV === "preview" && env.VERCEL_BRANCH_URL) {
    return `https://${env.VERCEL_BRANCH_URL}`;
  }
  if (env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }
  // Next sets PORT to the actual listener, including --port and automatic fallback.
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: An empty environment value means unset here and must fall back to the configured default.
  return `http://localhost:${process.env.PORT || "3000"}`;
};
/* oxlint-enable jsdoc/require-returns, node/no-process-env, typescript/strict-boolean-expressions */
