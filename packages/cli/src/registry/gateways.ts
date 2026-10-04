import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import type { GatewayDefinition } from "@chat-js/gateways/definition";

import { itemAddress, readItem } from "./shadcn";

type RegistryFile = NonNullable<
  Awaited<ReturnType<typeof readItem>>["files"]
>[number];

/* oxlint-disable import/no-relative-parent-imports -- Built-in gateway metadata has one canonical registry catalog; the CLI Bun build bundles this reexport, while the application @ alias points to apps/chat rather than registry sources. */
export { builtInGateways } from "../../../registry/src/gateways/catalog";
/* oxlint-enable import/no-relative-parent-imports */
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
  const definition = gatewayDefinitionSchema.parse(item.meta?.chatjs);
  if (
    item.files?.some(
      (file: Readonly<RegistryFile>) => file.target === "~/lib/ai/gateway.ts"
    ) !== true
  ) {
    throw new Error(
      "Gateway must install lib/ai/gateway.ts exporting Gateway."
    );
  }
  return { definition, source: address };
};
