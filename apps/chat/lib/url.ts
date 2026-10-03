import { env } from "@/lib/env";

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
