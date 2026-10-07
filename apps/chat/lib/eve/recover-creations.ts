/* oxlint-disable import/no-nodejs-modules --

 * import/no-nodejs-modules (#529): This server/tooling module requires import { setTimeout as delay } from "node:timers/promises";; its Node runtime boundary deliberately permits these built-ins.
 */
import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { getEveCreation, listPendingEveCreations } from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */

import { createConversationInput } from "./contracts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveCreationRecoveryError } from "./creation-recovery-error";
/* oxlint-enable sort-imports */
import { executeEveConversationCreation } from "./execute-conversation-creation";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve waitForConcurrentBinding's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): waitForConcurrentBinding uses 8, 1, 250 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
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
  for (let attempt = 0; attempt < 8; attempt += 1) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bound the wait for the request that already owns this creation.
    await delay(250);
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, no-continue, no-magic-numbers --
 * max-statements (#512): recoverEveCreations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): recoverEveCreations skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): recoverEveCreations uses 409 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-continue, no-magic-numbers */
