import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveProjectPath } from "./get-config";

describe("resolveProjectPath", () => {
  it("resolves aliases through JSONC TypeScript path mappings", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-config-"));
    try {
      await writeFile(
        path.join(cwd, "tsconfig.json"),
        `{
          // Custom aliases are valid shadcn configuration.
          "compilerOptions": {
            "baseUrl": ".",
            "paths": { "@/*": ["./*"], "#ui/*": ["./components/ui/*"] }
          }
        }`,
      );

      expect(await resolveProjectPath("@/tools/chatjs", cwd)).toBe(
        path.join(cwd, "tools/chatjs"),
      );
      expect(await resolveProjectPath("#ui/dialog", cwd)).toBe(
        path.join(cwd, "components/ui/dialog"),
      );
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });

  it("rejects mappings that resolve outside the project", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-config-"));
    try {
      await writeFile(
        path.join(cwd, "tsconfig.json"),
        JSON.stringify({ compilerOptions: { paths: { "#/*": ["../*"] } } }),
      );
      await expect(resolveProjectPath("#/outside", cwd)).rejects.toThrow(
        "inside the project directory",
      );
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
