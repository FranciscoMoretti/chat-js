import { env } from "@/lib/env";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getBaseUrl); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/**
 * Returns the base URL for the application.
 * Priority: APP_URL > preview branch URL > VERCEL_URL > localhost
 * @returns {string} Configured app URL, deployed HTTPS origin, or localhost origin using the active listener port.
 */
export const getBaseUrl = (): string => {
  if (typeof env.APP_URL === "string" && env.APP_URL !== "") {
    return env.APP_URL;
  }
  if (
    env.VERCEL_ENV === "preview" &&
    typeof env.VERCEL_BRANCH_URL === "string" &&
    env.VERCEL_BRANCH_URL !== ""
  ) {
    return `https://${env.VERCEL_BRANCH_URL}`;
  }
  if (typeof env.VERCEL_URL === "string" && env.VERCEL_URL !== "") {
    return `https://${env.VERCEL_URL}`;
  }
  // Next sets PORT to the actual listener, including --port and automatic fallback.
  // oxlint-disable-next-line node/no-process-env -- Read the active Next listener at call time; deployment env validation does not own this runtime override.
  const port = process.env.PORT;
  // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  return `http://localhost:${typeof port === "string" && port !== "" ? port : "3000"}`;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
