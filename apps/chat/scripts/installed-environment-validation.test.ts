import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { validatePluginEnvironment } from "./installed-environment-validation";

const mcpDirectory = path.resolve(import.meta.dirname, "../chatjs/plugins/mcp");
const mcpFiles = ["chatjs/plugins/mcp/validate-env.ts"];
const key = Buffer.alloc(32, 1).toString("base64");

it.each(
  [
    [],
    ["validate-env.ts"],
    ["../outside.ts"],
    ["chatjs/plugins/other/validate-env.ts"],
  ].map((files) => ({ files }))
)("skips validators outside the plugin's owned files", async ({ files }) => {
  expect(
    await validatePluginEnvironment(mcpDirectory, files, { NODE_ENV: "test" })
  ).toEqual([]);
});

it.each([
  undefined,
  "malformed-secret",
  `!${key}`,
  `${key}ignored`,
  key.replace("=", ""),
])(
  "reports the required format for missing and invalid MCP keys",
  async (value) => {
    expect(
      await validatePluginEnvironment(mcpDirectory, mcpFiles, {
        NODE_ENV: "test",
        MCP_ENCRYPTION_KEY: value,
      })
    ).toEqual(["MCP_ENCRYPTION_KEY must encode a 32-byte key."]);
  }
);

it("accepts a canonical base64-encoded 32-byte key", async () => {
  expect(
    await validatePluginEnvironment(mcpDirectory, mcpFiles, {
      NODE_ENV: "test",
      MCP_ENCRYPTION_KEY: key,
    })
  ).toEqual([]);
});

it("reports missing and failing declared validators without exposing their exceptions", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-validator-"));
  try {
    const broken = path.join(root, "broken");
    await mkdir(broken);
    await writeFile(
      path.join(broken, "validate-env.ts"),
      'export default () => { throw new Error("secret-value"); };'
    );
    const results = await Promise.all(
      ["broken", "missing"].map(
        async (id) =>
          await validatePluginEnvironment(
            path.join(root, id),
            [`chatjs/plugins/${id}/validate-env.ts`],
            { NODE_ENV: "test" }
          )
      )
    );
    for (const errors of results) {
      expect(errors).toEqual([
        "Unable to load or run the environment validator. Check validate-env.ts and its default export.",
      ]);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
