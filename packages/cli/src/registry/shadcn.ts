import { withRegistryTransport } from "./transport";
import {
	addRegistryItems,
	getRegistriesConfig,
	getRegistry,
	getRegistryItems,
} from "shadcn/registry";
import { registryItemSchema } from "shadcn/schema";

export const registryUrl =
	"https://unpkg.com/@chat-js/registry@1/dist/r/{name}.json";
export async function registryConfig(cwd: string) {
	const config = await getRegistriesConfig(cwd);
	return {
		registries: {
			"@chatjs": process.env.CHATJS_REGISTRY_URL ?? registryUrl,
			...config.registries,
		},
	};
}
export function itemAddress(source: string, kind: "gateway" | "tool" | "storage") {
  if (/^[a-z][a-z0-9-]*$/.test(source)) {
    const suffix = kind === "tool" || (kind === "gateway" && source.endsWith("-gateway")) ? "" : `-${kind}`;
    return `@chatjs/${source}${suffix}`;
  }
	return source;
}
export async function readItem(source: string, cwd: string) {
	const [item] = await withRegistryTransport(async () =>
		getRegistryItems([source], { config: await registryConfig(cwd) }),
	);
	return registryItemSchema.parse(item);
}
export async function listTools(cwd: string) {
	const catalog = await withRegistryTransport(async () =>
		getRegistry("@chatjs", { config: await registryConfig(cwd) }),
	);
	return catalog.items.filter((item) => item.meta?.chatjs?.kind === "tool");
}
export async function installItems(
	sources: string[],
	cwd: string,
	overwrite = false,
) {
	await withRegistryTransport(async () =>
		addRegistryItems(sources, {
			cwd,
			config: await registryConfig(cwd),
			overwrite,
			silent: true,
		}),
	);
}
