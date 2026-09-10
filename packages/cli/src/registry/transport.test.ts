import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installItems } from "./shadcn";
import { withRegistryTransport } from "./transport";

test("shadcn transitive registry requests retain transport policy and restore host fetch", async () => {
	const cwd = await mkdtemp(join(tmpdir(), "chatjs-transport-"));
	const original = globalThis.fetch;
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: () =>
			Response.json({
				name: "unsafe-dependency",
				type: "registry:item",
				registryDependencies: ["http://example.com/insecure.json"],
				files: [],
			}),
	});
	try {
		await expect(
			installItems([`http://127.0.0.1:${server.port}/root.json`], cwd),
		).rejects.toThrow("HTTPS");
		expect(globalThis.fetch).toBe(original);
		expect(await withRegistryTransport(async () => "next operation")).toBe(
			"next operation",
		);
		expect(globalThis.fetch).toBe(original);
	} finally {
		server.stop(true);
		await rm(cwd, { recursive: true, force: true });
	}
});
