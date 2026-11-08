import { and, or, sql } from "drizzle-orm";
import type {
  ChatLinks,
  ChatServerIntegration,
} from "@/chatjs/core/chat/contracts";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("chat.after-create");

const runAfter = async (
  adapters: readonly ChatServerIntegration[],
  contribution: "afterCreate" | "afterBranch",
  invoke: (adapter: ChatServerIntegration) => Promise<void>
): Promise<void> => {
  for (const adapter of adapters) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Optional work runs in declared order after the response.
      await invoke(adapter);
    } catch (error) {
      log.warn(
        {
          contribution,
          errorName: error instanceof Error ? error.name : typeof error,
        },
        "Chat post-creation contribution failed"
      );
    }
  }
};

/** Compose app and installed adapters without importing either implementation. */
export const composeChat = (
  adapters: readonly ChatServerIntegration[]
): Required<ChatServerIntegration> => ({
  onCreate: async (context) => {
    for (const adapter of adapters) {
      // oxlint-disable-next-line no-await-in-loop -- Transactional callbacks run in declared order; failure aborts the operation.
      await adapter.onCreate?.(context);
    }
  },
  onDeleteConversations: async (tx, context) => {
    for (const adapter of adapters) {
      // oxlint-disable-next-line no-await-in-loop -- Cleanup shares the caller's transaction and stops on failure.
      await adapter.onDeleteConversations?.(tx, context);
    }
  },
  onDelete: async (tx, chatId) => {
    for (const adapter of adapters) {
      // oxlint-disable-next-line no-await-in-loop -- Cleanup shares the caller's transaction and stops on failure.
      await adapter.onDelete?.(tx, chatId);
    }
  },
  afterCreate: async (context) => {
    await runAfter(adapters, "afterCreate", async (adapter) => {
      await adapter.afterCreate?.(context);
    });
  },
  afterBranch: async (context) => {
    await runAfter(adapters, "afterBranch", async (adapter) => {
      await adapter.afterBranch?.(context);
    });
  },
  historyFilter: (input, surface) =>
    and(...adapters.map((adapter) => adapter.historyFilter?.(input, surface))),
  publicReadFilter: () =>
    or(...adapters.map((adapter) => adapter.publicReadFilter?.())) ??
    sql`false`,
  links: async (ownerId, ids) => {
    const links = new Map<string, ChatLinks>();
    for (const adapter of adapters) {
      if (adapter.links) {
        // oxlint-disable-next-line no-await-in-loop -- Navigation ownership is resolved in declared order, never last-write-wins.
        for (const [id, value] of await adapter.links(ownerId, ids)) {
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
  },
});
