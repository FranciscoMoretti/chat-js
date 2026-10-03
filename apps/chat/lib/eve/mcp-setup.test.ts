/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { afterEach, expect, it, vi } from "vitest";

import { requireMcpCredentials } from "@/features/mcp/setup";
import { MissingCredentialsError } from "@/lib/required-credentials";
/* oxlint-enable sort-imports */

const credentials = vi.hoisted(() => ({ MCP_ENCRYPTION_KEY: "" }));
vi.mock("@/lib/env", () => ({ env: credentials }));
afterEach(() => {
  credentials.MCP_ENCRYPTION_KEY = "";
});

it("installed MCP reports a setup error without exposing secrets", () => {
  expect(requireMcpCredentials).toThrow(MissingCredentialsError);
  expect(requireMcpCredentials).toThrow(
    "Missing credentials for mcp: MCP_ENCRYPTION_KEY"
  );
  credentials.MCP_ENCRYPTION_KEY = "configured-secret";
  expect(requireMcpCredentials).not.toThrow();
});
