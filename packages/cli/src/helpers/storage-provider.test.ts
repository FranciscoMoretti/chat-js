import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import pathModule from "node:path";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { storageDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { builtInStorage } from "../../../registry/src/storage/catalog";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { getStorageEnvironmentRequirements } from "../../../registry/src/storage/environment";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { itemAddress } from "../registry/shadcn";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { resolveStorage } from "../registry/storage";
/* oxlint-enable import/no-relative-parent-imports */
import {
  configureStorageProvider,
  parseStorageOptions,
} from "./storage-provider";

// oxlint-disable-next-line typescript/unbound-method -- The fixture passes a receiver-independent mock or arrow callback so invocation identity remains observable.
const { join } = pathModule;

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
describe("storage registry integration", () => {
  it("resolves every built-in provider ID to its published item name", () => {
    for (const item of builtInStorage) {
      expect(itemAddress(item.meta.chatjs.id, "storage")).toBe(
        `@chatjs/${item.name}`
      );
    }
    expect(itemAddress("@acme/bucket", "storage")).toBe("@acme/bucket");
  });
  it("preserves Files SDK credential-chain and configured-option behavior", () => {
    expect(
      getStorageEnvironmentRequirements("s3", { region: "us-east-1" })
    ).toEqual([]);
    expect(getStorageEnvironmentRequirements("r2", { binding: {} })).toEqual(
      []
    );
    expect(
      getStorageEnvironmentRequirements("vercel-blob")[0]?.options.map(
        (option) => option.map((provider) => provider.key)
      )
    ).toEqual([
      ["BLOB_READ_WRITE_TOKEN"],
      ["VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"],
    ]);
  });
  it("rejects non-object options", () => {
    for (const input of ["", "[]", "null"]) {
      expect(() => parseStorageOptions(input)).toThrow("JSON object");
    }
  });
  it("accepts external storage and configures it without touching source or dependencies", async () => {
    const cwd = await mkdtemp(pathModule.join(tmpdir(), "chatjs-storage-"));
    try {
      await mkdir(join(cwd, "lib"));
      const definition = storageDefinitionSchema.parse({
        contractVersion: 1,
        envRequirements: [{ options: [["ACME_TOKEN"]] }],
        id: "acme",
        kind: "storage",
      });
      const source = join(cwd, "custom.json");
      const item = {
        files: [
          {
            content: "throw new Error('must not execute during configuration')",
            path: "provider.ts",
            target: "~/lib/storage-provider.ts",
            type: "registry:file",
          },
        ],
        meta: { chatjs: definition },
        name: "custom",
        type: "registry:item",
      };
      await writeFile(source, JSON.stringify(item));
      const selection = await resolveStorage(source, cwd);
      selection.options = { bucket: "uploads" };
      await writeFile(
        join(cwd, "lib/storage-provider.ts"),
        "// installed custom source"
      );
      await writeFile(join(cwd, "package.json"), "{}");
      await configureStorageProvider(cwd, selection);
      expect(
        await readFile(join(cwd, "lib/storage-provider.ts"), "utf-8")
      ).toBe("// installed custom source");
      expect(await readFile(join(cwd, "package.json"), "utf-8")).toBe("{}");
      expect(
        await readFile(join(cwd, "lib/storage-options.ts"), "utf-8")
      ).toContain('"bucket": "uploads"');
      expect(await readFile(join(cwd, ".env.example"), "utf-8")).toContain(
        "ACME_TOKEN="
      );
      await writeFile(
        source,
        JSON.stringify({
          ...item,
          meta: { chatjs: { ...definition, contractVersion: 999 } },
        })
      );
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
      await expect(resolveStorage(source, cwd)).rejects.toThrow();
      await writeFile(source, JSON.stringify({ ...item, files: [] }));
      // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- Await the asynchronous matcher before advancing the test; Bun matcher declarations expose a void result.
      await expect(resolveStorage(source, cwd)).rejects.toThrow(
        "storage-provider.ts"
      );
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
