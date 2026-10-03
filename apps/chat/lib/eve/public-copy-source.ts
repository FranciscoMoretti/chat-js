/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-queries" dependency within this package instead of introducing an alias or barrel API.
 */
import { Client } from "eve/client";

import { getPublicEveConversation } from "../db/eve-queries";
import { getEveConnectionOptions } from "./connection-options";
import { eveCopyBoundaries } from "./copy-boundaries";
import { prepareEveCopyTranscript } from "./copy-transcript";
import { assertEveConfigured } from "./server";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): readPublicEveCopySource uses 15_000, 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep readPublicEveCopySource's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readPublicEveCopySource's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): readPublicEveCopySource intentionally keeps the existing falsy-value behavior of row?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const readPublicEveCopySource = async (id: string) => {
  const row = await getPublicEveConversation(id);
  if (!row?.sessionId) {
    throw new Error("Shared conversation is unavailable.");
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(row.ownerId));
  const snapshot = await client.sessions
    .attach(row.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const current = await getPublicEveConversation(id);
  if (current?.sessionId !== row.sessionId || current.ownerId !== row.ownerId) {
    throw new Error("Shared conversation is unavailable.");
  }
  return {
    boundaries: eveCopyBoundaries(snapshot.events),
    id: row.id,
    ownerId: row.ownerId,
    projection: prepareEveCopyTranscript(snapshot.events),
    sessionId: row.sessionId,
    title: row.title ?? row.firstMessage.slice(0, 100),
  };
};
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
