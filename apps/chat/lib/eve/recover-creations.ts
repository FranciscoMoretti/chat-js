/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --

 * import/no-nodejs-modules (#529): This server/tooling module requires import { setTimeout as delay } from "node:timers/promises";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-queries" dependency within this package instead of introducing an alias or barrel API.
  */
import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

import { getEveCreation, listPendingEveCreations } from "../db/eve-queries";
import { createConversationInput } from "./contracts";
import { EveCreationRecoveryError } from "./creation-recovery-error";
import { executeEveConversationCreation } from "./execute-conversation-creation";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/strict-boolean-expressions --

 * jsdoc/require-param (#534): waitForConcurrentBinding's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): waitForConcurrentBinding's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): waitForConcurrentBinding uses 8, 1, 250 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/strict-boolean-expressions (#610): waitForConcurrentBinding intentionally keeps the existing falsy-value behavior of current.sessionId; current; distinguishing empty, zero, and absent states requires a domain behavior decision.
  */
/** Only wait for an explicitly identified lock contender; never retry dispatch here. */
const waitForConcurrentBinding = async (
  ownerId: string,
  operationId: string
): Promise<boolean> => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/strict-boolean-expressions */

/* oxlint-disable jsdoc/require-param, max-statements, no-continue, no-magic-numbers --

 * jsdoc/require-param (#534): recoverEveCreations's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): recoverEveCreations keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-continue (#515): recoverEveCreations skips inapplicable loop entries explicitly; moving the remaining work into nested branches changes the control-flow boundary.
 * no-magic-numbers (#517): recoverEveCreations uses 409 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
  */
/** Finish admitted commands before accounting for their native usage or admitting more work. */
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
/* oxlint-enable jsdoc/require-param, max-statements, no-continue, no-magic-numbers */
