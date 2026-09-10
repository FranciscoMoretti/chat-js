import { expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vendorEvePackage } from "./vendor-eve-package";

it("refuses to distribute a stale installed runtime", async () => {
	const root = await mkdtemp(join(tmpdir(), "eve-stale-package-test-"));
	try {
		const destination = join(root, "app");
		const packageDir = join(root, "eve");
		const patchPath = join(root, "eve.patch");
		await mkdir(destination);
		await mkdir(packageDir);
		await writeFile(join(destination, "package.json"), JSON.stringify({ dependencies: { eve: "0.52.2" } }));
		await writeFile(join(packageDir, "package.json"), JSON.stringify({ name: "eve", version: "0.52.2" }));
		await writeFile(join(packageDir, "runtime.js"), "original\n");
		await writeFile(patchPath, "diff --git a/runtime.js b/runtime.js\n--- a/runtime.js\n+++ b/runtime.js\n@@ -1 +1 @@\n-original\n+patched\n");
		await expect(vendorEvePackage({ destination, packageDir, patchPath })).rejects.toThrow();
		expect(await Bun.file(join(destination, "vendor/eve-0.52.2.tgz")).exists()).toBe(false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
