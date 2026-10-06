import { Client } from "eve/client";

import { getPublicEveConversation } from "@/lib/db/eve-queries";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveConnectionOptions } from "./connection-options";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveConfigured } from "./server";
/* oxlint-enable sort-imports */
import { sharedEveMessages } from "./shared-messages";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getPublicEveTranscript); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getPublicEveTranscript's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers, unicorn/no-null --
 * no-magic-numbers (#517): getPublicEveTranscript uses 15_000, 0, 100 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * unicorn/no-null (#570): getPublicEveTranscript preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const getPublicEveTranscript = async (
  id: string
): Promise<{
  id: string;
  messages: ReturnType<typeof sharedEveMessages>;
  title: string;
} | null> => {
  const row = await getPublicEveConversation(id);
  if (
    typeof row !== "object" ||
    row.sessionId === null ||
    row.sessionId === ""
  ) {
    return null;
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(row.ownerId));
  const snapshot = await client.sessions
    .attach(row.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  // A revocation during a slow snapshot read must take effect before disclosure.
  if (!(await getPublicEveConversation(id))) {
    return null;
  }
  return {
    id: row.id,
    messages: sharedEveMessages(snapshot.events),
    title: row.title ?? row.firstMessage.slice(0, 100),
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, unicorn/no-null */
