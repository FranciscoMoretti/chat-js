import { itemAddress, readItem } from "./shadcn";
import type { GatewayDefinition } from "@chat-js/gateways/definition";
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";

type RegistryFile = NonNullable<
  Awaited<ReturnType<typeof readItem>>["files"]
>[number];

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (builtInGateways); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable import/no-relative-parent-imports -- Built-in gateway metadata has one canonical registry catalog; the CLI Bun build bundles this reexport, while the application @ alias points to apps/chat rather than registry sources. */
export { builtInGateways } from "../../../registry/src/gateways/catalog";
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (GatewaySelection); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable import/no-relative-parent-imports */
export interface GatewaySelection {
  source: string;
  definition: GatewayDefinition;
}
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (resolveGateway); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveGateway's awaited sequencing and rejected-Promise behavior. */
export const resolveGateway = async (
  source: string,
  cwd = process.cwd()
): Promise<GatewaySelection> => {
  const address = itemAddress(source, "gateway");
  const item = await readItem(address, cwd);
  if (item.type !== "registry:item") {
    throw new Error("Selected gateway must have type registry:item.");
  }
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatjs from item.meta; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
  const definition = gatewayDefinitionSchema.parse(item.meta?.chatjs);
  if (
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading some from item.files; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
/* oxlint-enable import/no-named-export */
/* oxlint-enable oxc/no-async-await */
