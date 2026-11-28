import { and, or, sql } from "drizzle-orm";
import type {
  ChatLinks,
  ChatBranchGroup,
  ChatServerIntegration,
} from "@/chatjs/core/chat/contracts";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("chat.after-create");

const runAfter = async (
  integrations: readonly ChatServerIntegration[],
  invoke: (integration: ChatServerIntegration) => Promise<void>,
  branchId?: string
): Promise<void> => {
  for (const [integrationIndex, integration] of integrations.entries()) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Optional work runs in declared order after the response.
      await invoke(integration);
    } catch (error) {
      const errorName = error instanceof Error ? error.name : typeof error;
      if (branchId === undefined) {
        log.warn({ errorName }, "Chat afterCreate contribution failed");
      } else {
        log.warn(
          { errorName, integrationIndex, branchId },
          "Chat afterBranch contribution failed"
        );
      }
    }
  }
};

/** Compose app and installed integrations without importing either implementation. */
export const composeChat = (
  integrations: readonly ChatServerIntegration[]
): Required<ChatServerIntegration> => ({
  resolveCreationChatId: async (tx, ownerId, operationId) => {
    let chatId: string | undefined;
    for (const integration of integrations) {
      // oxlint-disable-next-line no-await-in-loop -- Chat IDs are resolved in declared integration order.
      const proposedChatId = await integration.resolveCreationChatId?.(
        tx,
        ownerId,
        operationId
      );
      if (proposedChatId === undefined) {
        continue;
      }
      if (chatId !== undefined) {
        throw new Error(
          "Multiple plugins claimed the same conversation operation."
        );
      }
      chatId = proposedChatId;
    }
    return chatId;
  },
  onFenceConversations: async (tx, ownerId, members) => {
    for (const integration of integrations) {
      // oxlint-disable-next-line no-await-in-loop -- Every fence shares the caller's transaction.
      await integration.onFenceConversations?.(tx, ownerId, members);
    }
  },
  branchGroups: async (ownerId, operationIds) => {
    const groups: ChatBranchGroup[] = [];
    const groupIds = new Set<string>();
    const groupedOperations = new Set<string>();
    for (const integration of integrations) {
      // oxlint-disable-next-line no-await-in-loop -- Resolve contributions in installation order.
      const contributed = await integration.branchGroups?.(
        ownerId,
        operationIds
      );
      for (const group of contributed ?? []) {
        if (groupIds.has(group.id)) {
          throw new Error(
            "Multiple integrations supplied the same prompt group."
          );
        }
        groupIds.add(group.id);
        for (const id of group.operationIds) {
          if (groupedOperations.has(id)) {
            throw new Error(
              "Multiple prompt group entries for the same branch operation."
            );
          }
          groupedOperations.add(id);
        }
        groups.push(group);
      }
    }
    return groups;
  },
  onCreate: async (context) => {
    for (const integration of integrations) {
      // oxlint-disable-next-line no-await-in-loop -- Transactional callbacks run in declared order; failure aborts the operation.
      await integration.onCreate?.(context);
    }
  },
  onDeleteConversations: async (tx, context) => {
    for (const integration of integrations) {
      // oxlint-disable-next-line no-await-in-loop -- Cleanup shares the caller's transaction and stops on failure.
      await integration.onDeleteConversations?.(tx, context);
    }
  },
  onDelete: async (tx, chatId) => {
    for (const integration of integrations) {
      // oxlint-disable-next-line no-await-in-loop -- Cleanup shares the caller's transaction and stops on failure.
      await integration.onDelete?.(tx, chatId);
    }
  },
  afterCreate: async (context) => {
    await runAfter(integrations, async (integration) => {
      await integration.afterCreate?.(context);
    });
  },
  afterBranch: async (context) => {
    await runAfter(
      integrations,
      async (integration) => {
        await integration.afterBranch?.(context);
      },
      context.branchId
    );
  },
  historyFilter: (input, surface) =>
    and(
      ...integrations.map((integration) =>
        integration.historyFilter?.(input, surface)
      )
    ),
  publicReadFilter: () =>
    or(
      ...integrations.map((integration) => integration.publicReadFilter?.())
    ) ?? sql`false`,
  links: async (ownerId, ids) => {
    const links = new Map<string, ChatLinks>();
    for (const integration of integrations) {
      if (integration.links) {
        // oxlint-disable-next-line no-await-in-loop -- Navigation ownership is resolved in declared order, never last-write-wins.
        for (const [id, value] of await integration.links(ownerId, ids)) {
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
