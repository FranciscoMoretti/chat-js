import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

import { getEveCreation, listPendingEveCreations } from "../db/eve-queries";
import { createConversationInput } from "./contracts";
import { EveCreationRecoveryError } from "./creation-recovery-error";
import { executeEveConversationCreation } from "./execute-conversation-creation";

/** Only wait for an explicitly identified lock contender; never retry dispatch here. */
const waitForConcurrentBinding = async (
  ownerId: string,
  operationId: string
) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound the wait for the request that already owns this creation.
    await delay(250);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Re-read durable state after each bounded wait.
    const current = await getEveCreation(ownerId, operationId);
    if (current?.state === "bound" && current.sessionId) {
      return true;
    }
    if (
      !current ||
      current.state === "deleted" ||
      current.state === "deleting"
    ) {
      return false;
    }
  }
  return false;
};

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
      // oxlint-disable-next-line eslint/no-await-in-loop -- Decode only the failed operation before continuing the recovery loop.
      const body = await response.json().catch(() => null);
      const conflict = z
        .object({ code: z.literal("creation_in_progress") })
        .safeParse(body);
      if (
        response.status === 409 &&
        conflict.success &&
        // oxlint-disable-next-line eslint/no-await-in-loop -- Accounting may continue only after the concurrent operation binds.
        (await waitForConcurrentBinding(ownerId, row.operationId))
      ) {
        continue;
      }
      throw new EveCreationRecoveryError();
    }
  }
};
