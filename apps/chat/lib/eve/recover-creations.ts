import { listPendingEveCreations } from "../db/eve-queries";
import { createConversationInput } from "./contracts";
import { EveCreationRecoveryError } from "./creation-recovery-error";
import { executeEveConversationCreation } from "./execute-conversation-creation";

/** Finish admitted commands before accounting for their native usage or admitting more work. */
export const recoverEveCreations = async (ownerId: string) => {
  const pending = await listPendingEveCreations(ownerId);
  for (const row of pending) {
    // Older plain-text commands can be reconstructed exactly. A content hash means
    // attachments or an explicit tool were present; never guess that missing input.
    const legacyInput =
      row.initialContentHash === null
        ? {
            fork: row.parentConversationId
              ? {
                  conversationId: row.parentConversationId,
                  ...(row.forkMessageId
                    ? { beforeMessageId: row.forkMessageId }
                    : {
                        beforeTurnId: row.forkTurnId,
                        checkpointId: row.forkCheckpointId ?? undefined,
                      }),
                }
              : undefined,
            forkKind: row.forkKind ?? undefined,
            message: row.firstMessage,
            modelId: row.initialModelId ?? undefined,
            operationId: row.operationId,
            projectId: row.initialProjectId ?? undefined,
          }
        : undefined;
    const command = createConversationInput.safeParse(
      row.initialRequest ?? legacyInput
    );
    if (!command.success || command.data.operationId !== row.operationId) {
      throw new EveCreationRecoveryError();
    }
    // Sequential recovery bounds load. The existing transaction lock arbitrates
    // concurrent browser retries and other reconciliation requests.
    // oxlint-disable-next-line eslint/no-await-in-loop -- Recover admitted commands in order before admitting new work.
    const response = await executeEveConversationCreation(
      ownerId,
      command.data
    );
    if (!response.ok) {
      throw new EveCreationRecoveryError();
    }
  }
};
