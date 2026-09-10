import { Client } from "eve/client";
import { getPublicEveConversation } from "../db/eve-queries";
import { env } from "../env";
import { assertEveConfigured } from "./server";
import { sharedEveMessages } from "./shared-messages";

export async function getPublicEveTranscript(id: string) {
  const row = await getPublicEveConversation(id);
  if (!row?.sessionId) {
    return null;
  }
  assertEveConfigured();
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": row.ownerId },
  });
  const snapshot = await client.sessions
    .attach(row.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  // A revocation during a slow snapshot read must take effect before disclosure.
  if (!(await getPublicEveConversation(id))) {
    return null;
  }
  return {
    id: row.id,
    title: row.title ?? row.firstMessage.slice(0, 100),
    messages: sharedEveMessages(snapshot.events),
  };
}
