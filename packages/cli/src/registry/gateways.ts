import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import type { GatewayDefinition } from "@chat-js/gateways/definition";

import { itemAddress, readItem } from "./shadcn";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
export { builtInGateways } from "../../../registry/src/gateways/catalog";
/* oxlint-enable import/no-relative-parent-imports */
export interface GatewaySelection {
  source: string;
  definition: GatewayDefinition;
}
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
  if (!item.files?.some((file) => file.target === "~/lib/ai/gateway.ts")) {
    throw new Error(
      "Gateway must install lib/ai/gateway.ts exporting Gateway."
    );
  }
  return { definition, source: address };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/strict-boolean-expressions */
