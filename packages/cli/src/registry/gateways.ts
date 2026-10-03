import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { GatewayDefinition } from "@chat-js/gateways/definition";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { itemAddress, readItem } from "./shadcn";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
export { builtInGateways } from "../../../registry/src/gateways/catalog";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export interface GatewaySelection {
  source: string;
  definition: GatewayDefinition;
}
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
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
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
