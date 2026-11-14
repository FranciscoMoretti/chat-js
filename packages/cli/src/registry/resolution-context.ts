import { AsyncLocalStorage } from "node:async_hooks";
import type { RegistryItem } from "shadcn/schema";

/** A replay may read only its recorded capability graph; never fall back to the network. */
export const registryResolution = new AsyncLocalStorage<
  ReadonlyMap<string, RegistryItem>
>();
