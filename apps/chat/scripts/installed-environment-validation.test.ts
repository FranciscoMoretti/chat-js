import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateInstalledEnvironment } from "./installed-environment-validation";

const mcpDirectory = path.resolve(import.meta.dirname, "../features/mcp");

describe("installed environment validators", () => {
  it("does not load an optional feature without a declared validator", async () => {
    expect(
      await validateInstalledEnvironment("/absent-feature", undefined, {
        NODE_ENV: "test",
      })
    ).toEqual([]);
  });

  it("uses MCP's format validation without exposing credentials", async () => {
    expect(
      await validateInstalledEnvironment(mcpDirectory, "mcp-env.ts", {
        NODE_ENV: "test",
        MCP_ENCRYPTION_KEY: "malformed-secret",
      })
    ).toEqual(["MCP_ENCRYPTION_KEY must encode a 32-byte key."]);
    expect(
      await validateInstalledEnvironment(mcpDirectory, "mcp-env.ts", {
        NODE_ENV: "test",
        MCP_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
      })
    ).toEqual([]);
  });

  it.each([
    "../outside.ts",
    "/absolute.ts",
    "nested/module.ts",
    "..\\outside.ts",
  ])(
    "rejects a validator outside the descriptor directory: %s",
    async (moduleName) => {
      await expect(
        validateInstalledEnvironment(mcpDirectory, moduleName, {
          NODE_ENV: "test",
        })
      ).rejects.toThrow();
    }
  );
});
