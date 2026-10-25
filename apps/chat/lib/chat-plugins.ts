import { createModuleLogger } from "./logger";
import { installedChatPlugins } from "@/composition/generated/installed-chat";
import type { ChatLinks, ChatCreatedContext } from "./chat-plugin-contracts";

export const chatLinks = async (
  ownerId: string,
  ids: readonly string[]
): Promise<ReadonlyMap<string, ChatLinks>> => {
  const links = new Map<string, ChatLinks>();
  for (const contribution of installedChatPlugins) {
    if (contribution.links) {
      // oxlint-disable-next-line no-await-in-loop -- Preserve deterministic contribution order.
      for (const [id, value] of await contribution.links(ownerId, ids)) {
        if (links.has(id)) {
          throw new Error(
            `Multiple plugins supplied navigation for chat ${id}`
          );
        }
        links.set(id, value);
      }
    }
  }
  return links;
};

const log = createModuleLogger("chat.after-create");

export const runChatAfterCreate = async (
  context: ChatCreatedContext
): Promise<void> => {
  for (const contribution of installedChatPlugins) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Optional work runs in installation order after the response.
      await contribution.afterCreate?.(context);
    } catch (error) {
      log.warn(
        { errorName: error instanceof Error ? error.name : typeof error },
        "Chat afterCreate contribution failed"
      );
    }
  }
};
