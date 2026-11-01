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

export const loadMcpOAuthCallbackSearchParams = createLoader(
  mcpOAuthCallbackSearchParamsServer
);
