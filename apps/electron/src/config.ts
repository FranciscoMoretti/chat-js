import { config } from "@/lib/config";

/* oxlint-disable import/exports-last -- APP_NAME: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- APP_NAME: Keep the named API with its implementation; existing direct exports are the consumer contract. */
export const APP_NAME = config.appName;
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */
/* oxlint-disable import/exports-last -- APP_SCHEME: The declaration is an existing named entrypoint used by consumers; its colocated export makes that boundary explicit. */
/* oxlint-disable import/group-exports -- APP_SCHEME: Keep the named API with its implementation; existing direct exports are the consumer contract. */
export const APP_SCHEME = config.appPrefix;
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */
const DEFAULT_DEV_APP_URL = "http://localhost:3000";

/* oxlint-disable import/group-exports -- APP_URL: Keep the named API with its implementation; existing direct exports are the consumer contract. */
/* oxlint-disable node/no-process-env -- APP_URL: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
/* oxlint-disable typescript/strict-boolean-expressions -- APP_URL: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
export const APP_URL =
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- An empty environment variable should select the default development URL.
  process.env.ELECTRON_APP_URL ||
  (process.env.NODE_ENV === "production" ? config.appUrl : DEFAULT_DEV_APP_URL);
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable node/no-process-env */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- WINDOW_DEFAULTS: Keep the named API with its implementation; existing direct exports are the consumer contract. */
export const WINDOW_DEFAULTS = {
  height: 800,
  minHeight: 600,
  minWidth: 800,
  width: 1280,
} as const;
/* oxlint-enable import/group-exports */
