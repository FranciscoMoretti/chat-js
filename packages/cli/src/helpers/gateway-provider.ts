import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GatewaySelection } from "../registry/gateways";
import { preflight } from "../utils/preflight";

/** Wire the installed gateway; source and dependencies are installed by shadcn. */
export async function configureGatewayProvider(
	destination: string,
	selection: GatewaySelection,
): Promise<void> {
	await preflight(destination, [
		"lib/ai/gateway-model-defaults.ts",
		"lib/ai/models.generated.ts",
		".env.example",
	]);
	const snapshotPath = join(destination, "lib/ai/models.generated.ts");
	const snapshot = await readFile(snapshotPath, "utf8").catch((error) => {
		if (error.code === "ENOENT") return "";
		throw error;
	});
	const example = join(destination, ".env.example");
	let env = await readFile(example, "utf8").catch((error) => {
		if (error.code === "ENOENT") return "";
		throw error;
	});
	const { definition } = selection;
	await writeFile(
		join(destination, "lib/ai/gateway-model-defaults.ts"),
		`import type { GatewayModelDefaults } from "@chat-js/gateways/defaults";
import type { Gateway } from "./gateway";

export const gatewayType = ${JSON.stringify(definition.id)} satisfies InstanceType<typeof Gateway>["type"];
export const gatewayModelDefaults = ${JSON.stringify(definition.defaults, null, 2)} satisfies GatewayModelDefaults<InstanceType<typeof Gateway>>;
export const gatewayCapabilities = ${JSON.stringify(definition.capabilities)};
export const gatewayEnvRequirements = ${JSON.stringify(definition.envRequirements)};
export const gatewayEnvVariables = ${JSON.stringify([...new Set([...definition.envRequirements.flatMap((r) => r.options.flat()), ...definition.optionalEnv])])};
`,
	);
	if (
		!snapshot.includes(`generatedForGateway = ${JSON.stringify(definition.id)}`)
	) {
		await writeFile(
			snapshotPath,
			`import type { AiGatewayModel } from "@chat-js/gateways/models";

export const generatedForGateway = ${JSON.stringify(definition.id)};
// Populate this gateway's catalog with the fetch:models script after setting credentials.
export const models: readonly AiGatewayModel[] = [];
`,
		);
	}
	for (const name of new Set(
		definition.envRequirements.flatMap((r) => r.options.flat()),
	)) {
		if (!new RegExp(`^${name}=`, "m").test(env)) env += `\n${name}=\n`;
	}
	await writeFile(example, env);
}
