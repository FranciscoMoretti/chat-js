import { registrySchema } from "shadcn/schema";
import { registryItems } from "./registry-items";
import { builtInStorage } from "./src/storage/catalog";
import { versionedRegistryItem } from "./dependency-contract";

const registry = registrySchema.parse({
  homepage: "https://chatjs.dev",
  name: "chatjs",
  items: [...registryItems, ...builtInStorage].map(versionedRegistryItem),
});
export {
  codeExecutionItem,
  searchToolItems,
  toolItems,
} from "./registry-items";
export { registry };
