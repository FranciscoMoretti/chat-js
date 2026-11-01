import { getEveCreation, listPendingEveCreations } from "@/lib/db/eve-queries";
import { EveCreationRecoveryError } from "./creation-recovery-error";
import { createConversationInput } from "./contracts";
import { setTimeout as delay } from "node:timers/promises";
import { executeEveConversationCreation } from "./execute-conversation-creation";
import { z } from "zod";

const MAX_CONCURRENT_BINDING_POLLS = 8;
const CONCURRENT_BINDING_POLL_DELAY_MS = 250;
const POLL_INCREMENT = 1;
/**
 * Wait for an identified lock contender without dispatching the command again.
 * @param {string} ownerId Owner whose durable creation state is polled.
 * @param {string} operationId Exact operation held by the concurrent request.
 * @returns {Promise<boolean>} Whether the operation binds with a session before the bounded wait ends; absent or retiring rows stop the wait.
 */
const waitForConcurrentBinding = async (
  ownerId: string,
  operationId: string
): Promise<boolean> => {
  for (
    let attempt = 0;
    attempt < MAX_CONCURRENT_BINDING_POLLS;
    attempt += POLL_INCREMENT
  ) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Recover admitted commands in order and poll only after the previous 250ms delay/read; stop on ambiguous conflict so accounting cannot admit new work.
    await delay(CONCURRENT_BINDING_POLL_DELAY_MS);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Recover admitted commands in order and poll only after the previous 250ms delay/read; stop on ambiguous conflict so accounting cannot admit new work.
    const current = await getEveCreation(ownerId, operationId);
    if (current?.state === "bound" && current.sessionId !== "") {
      return true;
    }
    if (
      typeof current !== "object" ||
      current.state === "deleted" ||
      current.state === "deleting"
    ) {
      return false;
    }
  }
  return false;
};

const HTTP_CONFLICT = 409;

/**
 * Finish admitted commands before accounting for native usage or admitting more work.
 * @param {string} ownerId Owner whose pending commands are recovered in order.
 * @returns {Promise<void>} Completion after every pending command succeeds or its identified lock contender binds; uncertain recovery throws.
 */
export const recoverEveCreations = async (ownerId: string): Promise<void> => {
  const pending = await listPendingEveCreations(ownerId);
  for (const row of pending) {
    const command = createConversationInput.safeParse(row.initialRequest);
    if (!command.success || command.data.operationId !== row.operationId) {
      throw new EveCreationRecoveryError();
    }
    // Sequential recovery bounds load. The existing transaction lock arbitrates
    // concurrent browser retries and other reconciliation requests.
    // oxlint-disable-next-line eslint/no-await-in-loop -- Recover admitted commands in order and poll only after the previous 250ms delay/read; stop on ambiguous conflict so accounting cannot admit new work.
    const response = await executeEveConversationCreation(
      ownerId,
      command.data
    );
    if (!response.ok) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Recover admitted commands in order and poll only after the previous 250ms delay/read; stop on ambiguous conflict so accounting cannot admit new work.
      const body: unknown = await response.json().catch((): void => {
        // The conflict schema below rejects an absent JSON body.
      });
      const conflict = z
        .object({ code: z.literal("creation_in_progress") })
        .safeParse(body);
      const boundByConcurrentRequest =
        response.status === HTTP_CONFLICT &&
        conflict.success &&
        // oxlint-disable-next-line eslint/no-await-in-loop -- Recover admitted commands in order and poll only after the previous 250ms delay/read; stop on ambiguous conflict so accounting cannot admit new work.
        (await waitForConcurrentBinding(ownerId, row.operationId));
      if (!boundByConcurrentRequest) {
        throw new EveCreationRecoveryError();
      }
    }
  }
};
