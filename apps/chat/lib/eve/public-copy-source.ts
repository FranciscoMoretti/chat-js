import { Client } from "eve/client";

import { getPublicEveConversation } from "../db/eve-queries";
import { env } from "../env";
import { eveCopyBoundaries } from "./copy-boundaries";
import { prepareEveCopyTranscript } from "./copy-transcript";
import { assertEveConfigured } from "./server";

export const readPublicEveCopySource = async (id: string) => {
  const row = await getPublicEveConversation(id);
  if (!row?.sessionId) {
    throw new Error("Shared conversation is unavailable.");
  }
  assertEveConfigured();
  const client = new Client({
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": row.ownerId },
    host: env.EVE_INTERNAL_ORIGIN ?? "",
  });
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
