import { expect, it } from "bun:test";
import { mkdtemp, rm, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { builtInGateways } from "../../../registry/src/gateways/catalog";
import { scaffoldFromTemplate } from "./scaffold";
import { configureGatewayProvider } from "./gateway-provider";
it("wires selected defaults and snapshot identity without managing dependencies", async () => {
	const cwd = await mkdtemp(join(tmpdir(), "chatjs-wiring-"));
	try {
		await scaffoldFromTemplate(cwd);
		await rm(join(cwd, "lib/ai/models.generated.ts"));
		const manifest = await readFile(join(cwd, "package.json"), "utf8");
		for (const item of builtInGateways) {
			await configureGatewayProvider(cwd, {
				source: item.name,
				definition: item.meta.chatjs,
			});
			expect(
				await readFile(join(cwd, "lib/ai/gateway-model-defaults.ts"), "utf8"),
			).toContain(`gatewayType = "${item.meta.chatjs.id}"`);
			expect(
				await readFile(join(cwd, "lib/ai/models.generated.ts"), "utf8"),
			).toContain(`generatedForGateway = "${item.meta.chatjs.id}"`);
			expect(await readFile(join(cwd, "package.json"), "utf8")).toBe(manifest);
		}
		const target = join(cwd, "lib/ai/gateway-model-defaults.ts");
		const snapshot = await readFile(
			join(cwd, "lib/ai/models.generated.ts"),
			"utf8",
		);
		await rm(target);
		await symlink(join(cwd, "package.json"), target);
		await expect(
			configureGatewayProvider(cwd, {
				source: "vercel",
				definition: builtInGateways[0].meta.chatjs,
			}),
		).rejects.toThrow("symlink");
		expect(await readFile(join(cwd, "package.json"), "utf8")).toBe(manifest);
		expect(
			await readFile(join(cwd, "lib/ai/models.generated.ts"), "utf8"),
		).toBe(snapshot);
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
});
