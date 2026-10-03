import { config } from "@/lib/config";

const APP_NAME = config.appName;

const APP_SCHEME = config.appPrefix;

const DEFAULT_DEV_APP_URL = "http://localhost:3000";

/* oxlint-disable node/no-process-env -- APP_URL: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
/* oxlint-disable typescript/strict-boolean-expressions -- APP_URL: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
const APP_URL =
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- An empty environment variable should select the default development URL.
  process.env.ELECTRON_APP_URL ||
  (process.env.NODE_ENV === "production" ? config.appUrl : DEFAULT_DEV_APP_URL);
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable node/no-process-env */

const WINDOW_DEFAULTS = {
  height: 800,
  minHeight: 600,
  minWidth: 800,
  width: 1280,
} as const;
export { APP_NAME, APP_SCHEME, APP_URL, WINDOW_DEFAULTS };
