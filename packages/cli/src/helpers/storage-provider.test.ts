import { describe, expect, it } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import pathModule from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { itemAddress } from "#cli/registry/shadcn";
/* oxlint-enable sort-imports */
import { resolveStorage } from "#cli/registry/storage";

// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { storageDefinitionSchema } from "../../../registry/metadata";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { builtInStorage } from "../../../registry/src/storage/catalog";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-relative-parent-imports -- This shared registry or app schema is outside the CLI package and is bundled into its published executable.
import { getStorageEnvironmentRequirements } from "../../../registry/src/storage/environment";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  configureStorageProvider,
  parseStorageOptions,
} from "./storage-provider";
/* oxlint-enable sort-imports */

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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading options from getStorageEnvironmentRequirements(...)[0]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
  it("accepts external storage and configures it without touching source or dependencies", async () => {
    const cwd = await mkdtemp(pathModule.join(tmpdir(), "chatjs-storage-"));
    try {
      await mkdir(pathModule.join(cwd, "lib"));
      const definition = storageDefinitionSchema.parse({
        contractVersion: 1,
        envRequirements: [{ options: [["ACME_TOKEN"]] }],
        id: "acme",
        kind: "storage",
      });
      const source = pathModule.join(cwd, "custom.json");
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
        pathModule.join(cwd, "lib/storage-provider.ts"),
        "// installed custom source"
      );
      await writeFile(pathModule.join(cwd, "package.json"), "{}");
      await configureStorageProvider(cwd, selection);
      expect(
        await readFile(pathModule.join(cwd, "lib/storage-provider.ts"), "utf-8")
      ).toBe("// installed custom source");
      expect(
        await readFile(pathModule.join(cwd, "package.json"), "utf-8")
      ).toBe("{}");
      expect(
        await readFile(pathModule.join(cwd, "lib/storage-options.ts"), "utf-8")
      ).toContain('"bucket": "uploads"');
      expect(
        await readFile(pathModule.join(cwd, ".env.example"), "utf-8")
      ).toContain("ACME_TOKEN=");
      await writeFile(
        source,
        JSON.stringify({
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...item,
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing definition own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          meta: { chatjs: { ...definition, contractVersion: 999 } },
        })
      );
      expect(resolveStorage(source, cwd)).rejects.toThrow();
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing item own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      await writeFile(source, JSON.stringify({ ...item, files: [] }));
      expect(resolveStorage(source, cwd)).rejects.toThrow(
        "storage-provider.ts"
      );
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
