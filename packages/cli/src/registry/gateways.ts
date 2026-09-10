import {
	gatewayDefinitionSchema,
	type GatewayDefinition,
} from "@chat-js/gateways/definition";
import { builtInGateways } from "../../../registry/src/gateways/catalog";
import { itemAddress, readItem } from "./shadcn";
export { builtInGateways };
export interface GatewaySelection {
	source: string;
	definition: GatewayDefinition;
}
export async function resolveGateway(
	source: string,
	cwd = process.cwd(),
): Promise<GatewaySelection> {
	const address = itemAddress(source, "gateway");
	const item = await readItem(address, cwd);
	if (item.type !== "registry:item")
		throw new Error("Selected gateway must have type registry:item.");
	const definition = gatewayDefinitionSchema.parse(item.meta?.chatjs);
	if (!item.files?.some((file) => file.target === "~/lib/ai/gateway.ts"))
		throw new Error(
			"Gateway must install lib/ai/gateway.ts exporting Gateway.",
		);
	return { source: address, definition };
}
