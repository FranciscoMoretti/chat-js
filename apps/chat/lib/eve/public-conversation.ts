import { Client } from "eve/client";

import { getPublicEveConversation } from "../db/eve-queries";
import { getEveConnectionOptions } from "./connection-options";
import { assertEveConfigured } from "./server";
import { sharedEveMessages } from "./shared-messages";

export const getPublicEveTranscript = async (id: string) => {
  const row = await getPublicEveConversation(id);
  if (!row?.sessionId) {
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
