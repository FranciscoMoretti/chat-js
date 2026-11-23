import type { InstalledRouters } from "@/chatjs/core/installation/contracts";

/** Server contributions stay out of the client configuration graph. */
interface ChatPlugin {
  readonly id: string;
  readonly routers?: InstalledRouters;
}

type PluginRouterMap<Plugin extends ChatPlugin> = Plugin extends {
  readonly routers: infer Routers extends InstalledRouters;
}
  ? Routers
  : "routers" extends keyof Plugin
    ? [NonNullable<Plugin["routers"]>] extends [never]
      ? object
      : Partial<NonNullable<Plugin["routers"]>>
    : object;

type CollectedRouterMaps<Plugins extends readonly ChatPlugin[]> =
  Plugins extends readonly [
    infer First extends ChatPlugin,
    ...infer Rest extends readonly ChatPlugin[],
  ]
    ? PluginRouterMap<First> & CollectedRouterMaps<Rest>
    : number extends Plugins["length"]
      ? Partial<InstalledRouters>
      : object;

type MergedPluginRouters<Plugins extends readonly ChatPlugin[]> = {
  [
    Key in keyof CollectedRouterMaps<Plugins>
  ]: CollectedRouterMaps<Plugins>[Key];
};

/** Preserve each installed router's procedure types across the merge. */
export function mergePluginRouters<const Plugins extends readonly ChatPlugin[]>(
  plugins: Plugins
): MergedPluginRouters<Plugins>;
export function mergePluginRouters(
  plugins: readonly ChatPlugin[]
): InstalledRouters {
  const merged: InstalledRouters = {};
  const owners = new Map<string, string>([
    ["eve", "ChatJS"],
    ["__proto__", "JavaScript"],
  ]);
  for (const { id, routers } of plugins) {
    if (!routers) {
      continue;
    }
    for (const [key, router] of Object.entries(routers)) {
      const owner = owners.get(key);
      if (owner !== undefined) {
        throw new Error(
          `Duplicate or reserved plugin router: ${key} (${owner}, ${id}).`
        );
      }
      owners.set(key, id);
      merged[key] = router;
    }
  }
  return merged;
}

export type { ChatPlugin };
