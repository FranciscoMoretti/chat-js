import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { toolItems } from "../../../registry/registry";

// Recognize only known legacy declarations, in any installation order. Never
// evaluate source or discard unknown registrations during migration.
export async function legacyTools(cwd: string, tools: string, ui: string) {
	const compact = (source: string) =>
		source.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, "");
	let server = compact(tools);
	let client = compact(ui).replace(
		'importtype{ToolRendererRegistry}from"@/lib/ai/tool-renderer-registry";',
		"",
	);
	const definitions = [];
	for (const {
		meta: { chatjs: item },
	} of toolItems) {
		const serverImport = compact(
			`import { ${item.toolExport} } from "@/tools/chatjs/${item.id}/tool";`,
		);
		const clientImport = compact(
			`import { ${item.rendererExport} } from "@/tools/chatjs/${item.id}/renderer";`,
		);
		if (server.includes(serverImport) !== client.includes(clientImport))
			return null;
		if (!server.includes(serverImport)) continue;
		server = server.replace(serverImport, "");
		client = client.replace(clientImport, "");
		definitions.push(item);
	}
	const serverEntries = server.match(
		/^exportconsttools=\{([^{}]*)\}asconst;$/,
	)?.[1];
	const clientEntries = client.match(
		/^exportconstui=\{([^{}]*)\}(?:satisfiesToolRendererRegistry)?;$/,
	)?.[1];
	if (serverEntries === undefined || clientEntries === undefined) return null;
	const entries = (body: string) =>
		body.split(",").filter(Boolean).sort().join(",");
	if (
		entries(serverEntries) !==
		entries(definitions.map((item) => item.toolExport).join(","))
	)
		return null;
	if (
		entries(clientEntries) !==
		entries(
			definitions
				.map((item) => `"tool-${item.toolExport}":${item.rendererExport}`)
				.join(","),
		)
	)
		return null;
	for (const item of definitions) {
		await readFile(join(cwd, "tools/chatjs", item.id, "tool.ts"));
		await readFile(join(cwd, "tools/chatjs", item.id, "renderer.tsx"));
	}
	return definitions;
}
