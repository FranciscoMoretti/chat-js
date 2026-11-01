import { itemAddress, readItem } from "./shadcn";
import type { GatewayDefinition } from "@chat-js/gateways/definition";
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

type RegistryFile = NonNullable<
  Awaited<ReturnType<typeof readItem>>["files"]
>[number];

export { builtInGateways } from "../../../registry/src/gateways/catalog";
export interface GatewaySelection {
  source: string;
  definition: GatewayDefinition;
}
export const resolveGateway = async (
  source: string,
  cwd = process.cwd()
): Promise<GatewaySelection> => {
  const address = itemAddress(source, "gateway");
  const item = await readItem(address, cwd);
  if (item.type !== "registry:item") {
    throw new Error("Selected gateway must have type registry:item.");
  }
  const { chatjs } = item.meta ?? {};
  const definition = gatewayDefinitionSchema.parse(chatjs);
  if (
    !(item.files ?? []).some(
      (file: Readonly<RegistryFile>) =>
        file.target === "~/chatjs/providers/gateway.ts"
    )
  ) {
    throw new Error(
      "Gateway must install chatjs/providers/gateway.ts exporting Gateway."
    );
  }
  return { definition, source: address };
};
