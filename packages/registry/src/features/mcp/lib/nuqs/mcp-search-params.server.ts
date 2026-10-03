import { createLoader, parseAsString } from "nuqs/server";

/**
 * IMPORTANT:
 * This file must only use parsers imported from `nuqs/server`.
 * Importing parsers from `nuqs` here can produce parser objects without
 * `serialize()` at runtime (route handlers), which breaks serializer/loader helpers.
 */

const mcpOAuthCallbackSearchParamsServer = {
  code: parseAsString,
  error: parseAsString,
  error_description: parseAsString,
  state: parseAsString,
};

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const loadMcpOAuthCallbackSearchParams = createLoader(
  mcpOAuthCallbackSearchParamsServer
);
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
