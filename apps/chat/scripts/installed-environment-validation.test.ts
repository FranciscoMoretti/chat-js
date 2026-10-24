import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { validateInstalledEnvironment } from "./installed-environment-validation";

const mcpDirectory = path.resolve(import.meta.dirname, "../plugins/mcp");

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
      expect(
        await validateInstalledEnvironment(mcpDirectory, moduleName, {
          NODE_ENV: "test",
        })
      ).toEqual([
        "Unable to load or run the environment validator. Check its module and validateEnvironment export.",
      ]);
    }
  );
});

it("isolates missing and throwing validators while other results remain available", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-validator-"));
  try {
    await writeFile(
      path.join(directory, "throws.mjs"),
      'export const validateEnvironment = () => { throw new Error("secret-value"); };'
    );
    const results = await Promise.all([
      validateInstalledEnvironment(directory, "missing.mjs", {
        NODE_ENV: "test",
      }),
      validateInstalledEnvironment(directory, "throws.mjs", {
        NODE_ENV: "test",
      }),
      validateInstalledEnvironment(mcpDirectory, "mcp-env.ts", {
        NODE_ENV: "test",
        MCP_ENCRYPTION_KEY: "invalid",
      }),
    ]);
    expect(results).toEqual([
      [
        "Unable to load or run the environment validator. Check its module and validateEnvironment export.",
      ],
      [
        "Unable to load or run the environment validator. Check its module and validateEnvironment export.",
      ],
      ["MCP_ENCRYPTION_KEY must encode a 32-byte key."],
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("rejects noncanonical base64 keys even when decoding yields 32 bytes", async () => {
  const valid = Buffer.alloc(32, 1).toString("base64");
  await Promise.all(
    [`!${valid}`, `${valid}ignored`, valid.replace("=", "")].map(
      async (key) => {
        expect(
          await validateInstalledEnvironment(mcpDirectory, "mcp-env.ts", {
            NODE_ENV: "test",
            MCP_ENCRYPTION_KEY: key,
          })
        ).toEqual(["MCP_ENCRYPTION_KEY must encode a 32-byte key."]);
      }
    )
  );
});

it("rejects an existing validator outside the descriptor directory before execution", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-validator-path-"));
  try {
    const item = path.join(root, "item");
    await mkdir(item);
    await writeFile(
      path.join(root, "outside.mjs"),
      'export const validateEnvironment = () => ["outside validator executed"];'
    );
    const result = await validateInstalledEnvironment(item, "../outside.mjs", {
      NODE_ENV: "test",
    });
    expect(result).toEqual([
      "Unable to load or run the environment validator. Check its module and validateEnvironment export.",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
