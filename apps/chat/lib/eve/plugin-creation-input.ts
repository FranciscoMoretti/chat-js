import {
  installedCreationFields,
  installedSharedPlugins,
} from "@/composition/generated/installed-shared";
import type { ChatCreationScope } from "@/lib/chat-plugin-contracts";

/** Preserve only declared plugin inputs when deriving another creation command. */
export const pluginCreationInput = (
  input: Readonly<Record<string, unknown>>
): Record<string, unknown> =>
  Object.fromEntries(
    Object.keys(installedCreationFields)
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, input[key]])
  );

export const pluginCreationScope = (
  input: unknown
): ChatCreationScope | undefined => {
  const scopes = installedSharedPlugins.flatMap((plugin) => {
    const scope = plugin.creationScope?.(input);
    return scope ? [scope] : [];
  });
  if (scopes.length > 1) {
    throw new Error("Multiple plugins supplied a creation scope.");
  }
  return scopes.at(0);
};
