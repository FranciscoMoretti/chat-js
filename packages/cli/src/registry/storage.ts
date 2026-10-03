/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { storageDefinitionSchema } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { StorageDefinition } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { itemAddress, readItem } from "./shadcn";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export interface StorageSelection {
  source: string;
  definition: StorageDefinition;
  options: Record<string, unknown>;
}
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const resolveStorage = async (
  source: string,
  cwd = process.cwd()
): Promise<StorageSelection> => {
  const address = itemAddress(source, "storage");
  const item = await readItem(address, cwd);
  if (item.type !== "registry:item") {
    throw new Error("Selected storage must have type registry:item.");
  }
  const definition = storageDefinitionSchema.parse(item.meta?.chatjs);
  if (
    !item.files?.some((file) => file.target === "~/lib/storage-provider.ts")
  ) {
    throw new Error(
      "Storage must install lib/storage-provider.ts exporting createStorageAdapter."
    );
  }
  return { definition, options: {}, source: address };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
