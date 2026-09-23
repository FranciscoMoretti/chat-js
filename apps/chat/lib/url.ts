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
  return "http://localhost:3000";
};
