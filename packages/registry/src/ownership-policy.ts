import type { RegistryItem } from "shadcn/schema";
import type { OwnedFile } from "./file-ownership";

// Approved core contract. Additions need review, not a snapshot of current imports.
const publicCoreContracts: ReadonlySet<string> = new Set([
  "lib/eve/session-identity.ts",
  "lib/config-models.ts",
]);

const crossingStatus = (
  from: Readonly<OwnedFile>,
  to: Readonly<OwnedFile>,
  generated: boolean,
  items: readonly RegistryItem[]
):
  | "declared-dependency"
  | "generated-composition"
  | "public-core-contract"
  | "needs-review" => {
  if (from.kind === "core" && generated) {
    return "generated-composition";
  }
  if (to.kind === "core" && publicCoreContracts.has(to.path)) {
    return "public-core-contract";
  }
  if (
    from.owners.some((owner) => {
      const dependencies =
        items.find((item) => item.name === owner)?.registryDependencies ?? [];
      return to.owners.some((target) =>
        dependencies.includes(`@chatjs/${target}`)
      );
    })
  ) {
    return "declared-dependency";
  }
  return "needs-review";
};

export { crossingStatus };
