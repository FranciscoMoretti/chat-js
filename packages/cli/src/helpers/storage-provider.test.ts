import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	configureStorageProvider,
	parseStorageOptions,
} from "./storage-provider";
import { storageDefinitionSchema } from "../../../registry/metadata";
import { resolveStorage } from "../registry/storage";
import { getStorageEnvironmentRequirements } from "../../../registry/src/storage/environment";

describe("storage registry integration", () => {
	it("preserves Files SDK credential-chain and configured-option behavior", () => {
		expect(
			getStorageEnvironmentRequirements("s3", { region: "us-east-1" }),
		).toEqual([]);
		expect(getStorageEnvironmentRequirements("r2", { binding: {} })).toEqual(
			[],
		);
		expect(
			getStorageEnvironmentRequirements("vercel-blob")[0]?.options.map(
				(option) => option.map((v) => v.key),
			),
		).toEqual([
			["BLOB_READ_WRITE_TOKEN"],
			["VERCEL_OIDC_TOKEN", "BLOB_STORE_ID"],
		]);
	});
	it("rejects non-object options", () => {
		for (const input of ["", "[]", "null"])
			expect(() => parseStorageOptions(input)).toThrow("JSON object");
	});
	it("accepts external storage and configures it without touching source or dependencies", async () => {
		const cwd = await mkdtemp(join(tmpdir(), "chatjs-storage-"));
		try {
			await mkdir(join(cwd, "lib"));
			const definition = storageDefinitionSchema.parse({
				contractVersion: 1,
				kind: "storage",
				id: "acme",
				envRequirements: [{ options: [["ACME_TOKEN"]] }],
			});
			const source = join(cwd, "custom.json");
			const item = {
				name: "custom",
				type: "registry:item",
				files: [
					{
						path: "provider.ts",
						type: "registry:file",
						target: "~/lib/storage-provider.ts",
						content: "throw new Error('must not execute during configuration')",
					},
				],
				meta: { chatjs: definition },
			};
			await writeFile(source, JSON.stringify(item));
			const selection = await resolveStorage(source, cwd);
			selection.options = { bucket: "uploads" };
			await writeFile(
				join(cwd, "lib/storage-provider.ts"),
				"// installed custom source",
			);
			await writeFile(join(cwd, "package.json"), "{}");
			await configureStorageProvider(cwd, selection);
			expect(await readFile(join(cwd, "lib/storage-provider.ts"), "utf8")).toBe(
				"// installed custom source",
			);
			expect(await readFile(join(cwd, "package.json"), "utf8")).toBe("{}");
			expect(
				await readFile(join(cwd, "lib/storage-options.ts"), "utf8"),
			).toContain('"bucket": "uploads"');
			expect(await readFile(join(cwd, ".env.example"), "utf8")).toContain(
				"ACME_TOKEN=",
			);
			await writeFile(
				source,
				JSON.stringify({
					...item,
					meta: { chatjs: { ...definition, contractVersion: 999 } },
				}),
			);
			await expect(resolveStorage(source, cwd)).rejects.toThrow();
			await writeFile(source, JSON.stringify({ ...item, files: [] }));
			await expect(resolveStorage(source, cwd)).rejects.toThrow(
				"storage-provider.ts",
			);
		} finally {
			await rm(cwd, { recursive: true, force: true });
		}
	});
});
