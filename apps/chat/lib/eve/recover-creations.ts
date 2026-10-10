/* oxlint-disable import/no-nodejs-modules --

 * import/no-nodejs-modules (#529): This server/tooling module requires import { setTimeout as delay } from "node:timers/promises";; its Node runtime boundary deliberately permits these built-ins.
 */
import { getEveCreation, listPendingEveCreations } from "@/lib/db/eve-queries";
import { EveCreationRecoveryError } from "./creation-recovery-error";
import { createConversationInput } from "./contracts";
import { setTimeout as delay } from "node:timers/promises";
import { executeEveConversationCreation } from "./execute-conversation-creation";
import { z } from "zod";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve waitForConcurrentBinding's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

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
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound the wait for the request that already owns this creation.
    await delay(CONCURRENT_BINDING_POLL_DELAY_MS);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Re-read durable state after each bounded wait.
    const current = await getEveCreation(ownerId, operationId);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading state from current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (recoverEveCreations); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve recoverEveCreations's awaited sequencing and rejected-Promise behavior. */

const HTTP_CONFLICT = 409;

/* oxlint-disable max-statements --
 * max-statements (#512): recoverEveCreations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
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
    // oxlint-disable-next-line eslint/no-await-in-loop -- Recover admitted commands in order before admitting new work.
    const response = await executeEveConversationCreation(
      ownerId,
      command.data
    );
    if (!response.ok) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Decode only the failed operation before continuing the recovery loop.
      const body: unknown = await response.json().catch((): void => {
        // The conflict schema below rejects an absent JSON body.
      });
      const conflict = z
        .object({ code: z.literal("creation_in_progress") })
        .safeParse(body);
      const boundByConcurrentRequest =
        response.status === HTTP_CONFLICT &&
        conflict.success &&
        // oxlint-disable-next-line eslint/no-await-in-loop -- Accounting may continue only after the concurrent operation binds.
        (await waitForConcurrentBinding(ownerId, row.operationId));
      if (!boundByConcurrentRequest) {
        throw new EveCreationRecoveryError();
      }
    }
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
