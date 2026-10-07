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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (loadMcpOAuthCallbackSearchParams); the enabled import/no-default-export convention rejects the default-export alternative. */
export const loadMcpOAuthCallbackSearchParams = createLoader(
  mcpOAuthCallbackSearchParamsServer
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
