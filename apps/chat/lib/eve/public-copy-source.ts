import { Client } from "eve/client";

import { getPublicEveConversation } from "@/lib/db/eve-queries";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveConnectionOptions } from "./connection-options";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveCopyBoundaries } from "./copy-boundaries";
/* oxlint-enable sort-imports */
import { prepareEveCopyTranscript } from "./copy-transcript";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveConfigured } from "./server";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (readPublicEveCopySource); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readPublicEveCopySource's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions --
 * no-magic-numbers (#517): readPublicEveCopySource uses 15_000, 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep readPublicEveCopySource's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep readPublicEveCopySource's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/strict-boolean-expressions (#610): readPublicEveCopySource intentionally keeps the existing falsy-value behavior of row?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const readPublicEveCopySource = async (id: string) => {
  const row = await getPublicEveConversation(id);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from row; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (!row?.sessionId) {
    throw new Error("Shared conversation is unavailable.");
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(row.ownerId));
  const snapshot = await client.sessions
    .attach(row.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const current = await getPublicEveConversation(id);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading sessionId from current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/strict-boolean-expressions */
