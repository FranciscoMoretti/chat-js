import {
  configureStorageProvider,
  parseStorageOptions,
} from "./storage-provider";
import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { builtInStorage } from "../../../registry/src/storage/catalog";
import { getStorageEnvironmentRequirements } from "../../../registry/src/storage/environment";
import { itemAddress } from "#cli/registry/shadcn";
import pathModule from "node:path";
import { resolveStorage } from "#cli/registry/storage";
import { storageDefinitionSchema } from "../../../registry/metadata";
import { tmpdir } from "node:os";

const firstRequirementIndex = 0;

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
    const firstRequirement =
      getStorageEnvironmentRequirements("vercel-blob")[firstRequirementIndex];
    expect(
      firstRequirement.options.map(
        (option: readonly { readonly key: string }[]) =>
          option.map((provider: { readonly key: string }) => provider.key)
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
      await mkdir(pathModule.join(cwd, "chatjs/providers"), {
        recursive: true,
      });
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
            target: "~/chatjs/providers/storage.ts",
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
        pathModule.join(cwd, "chatjs/providers/storage.ts"),
        "// installed custom source"
      );
      await writeFile(pathModule.join(cwd, "package.json"), "{}");
      await configureStorageProvider(cwd, selection);
      expect(
        await readFile(
          pathModule.join(cwd, "chatjs/providers/storage.ts"),
          "utf-8"
        )
      ).toBe("// installed custom source");
      expect(
        await readFile(pathModule.join(cwd, "package.json"), "utf-8")
      ).toBe("{}");
      expect(
        await readFile(
          pathModule.join(cwd, "chatjs/providers/storage-options.ts"),
          "utf-8"
        )
      ).toContain('"bucket": "uploads"');
      expect(
        await readFile(pathModule.join(cwd, ".env.example"), "utf-8")
      ).toContain("ACME_TOKEN=");
      await writeFile(
        source,
        JSON.stringify({
          ...item,
          meta: { chatjs: { ...definition, contractVersion: 999 } },
        })
      );
      expect(resolveStorage(source, cwd)).rejects.toThrow();
      await writeFile(source, JSON.stringify({ ...item, files: [] }));
      expect(resolveStorage(source, cwd)).rejects.toThrow(
        "chatjs/providers/storage.ts"
      );
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
