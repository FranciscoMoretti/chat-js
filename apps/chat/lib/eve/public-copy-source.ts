/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-queries" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { Client } from "eve/client";

import { getPublicEveConversation } from "../db/eve-queries";
import { getEveConnectionOptions } from "./connection-options";
import { eveCopyBoundaries } from "./copy-boundaries";
import { prepareEveCopyTranscript } from "./copy-transcript";
import { assertEveConfigured } from "./server";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions  --
 * import/no-named-export (#527): Preserve the named readPublicEveCopySource API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): readPublicEveCopySource remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-magic-numbers (#517): readPublicEveCopySource uses 15_000, 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): readPublicEveCopySource sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): readPublicEveCopySource handles optional row?.sessionId; current?.sessionId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
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
