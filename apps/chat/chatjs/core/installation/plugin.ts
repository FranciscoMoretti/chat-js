import type { InstalledRouters } from "@/chatjs/core/installation/contracts";

/** Server contributions stay out of the client configuration graph. */
interface ChatPlugin {
  readonly id: string;
  readonly routers?: InstalledRouters;
}

export const assertUniquePluginRouters = (
  plugins: readonly ChatPlugin[]
): void => {
  const owners = new Map<string, string>([
    ["eve", "ChatJS"],
    ["__proto__", "JavaScript"],
  ]);
  for (const { id, routers } of plugins) {
    for (const key of Object.keys(routers ?? {})) {
      const owner = owners.get(key);
      if (owner !== undefined) {
        throw new Error(
          `Duplicate or reserved plugin router: ${key} (${owner}, ${id}).`
        );
      }
      owners.set(key, id);
    }
  }
};

export type { ChatPlugin };
