import { getEveMessageDisplayReceipts } from "@/lib/db/eve-dispatch";
import { Client } from "eve/client";
import { assertEveConfigured } from "./server";
import { getEveConnectionOptions } from "./connection-options";
import { getPublicEveConversation } from "@/lib/db/eve-queries";
import { sharedEveMessages } from "./shared-messages";

const PUBLIC_TRANSCRIPT_SNAPSHOT_TIMEOUT_MS = 15_000;
const PUBLIC_TRANSCRIPT_TITLE_PREVIEW_MAX_LENGTH = 100;
const TITLE_PREVIEW_START = 0;

export const getPublicEveTranscript = async (
  id: string
): Promise<{
  id: string;
  messages: ReturnType<typeof sharedEveMessages>;
  title: string;
} | null> => {
  const row = await getPublicEveConversation(id);
  if (!row || row.sessionId === null || row.sessionId === "") {
    return null;
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(row.ownerId));
  const snapshot = await client.sessions.attach(row.sessionId).snapshot({
    signal: AbortSignal.timeout(PUBLIC_TRANSCRIPT_SNAPSHOT_TIMEOUT_MS),
  });
  const receipts = await getEveMessageDisplayReceipts(
    row.ownerId,
    row.sessionId
  );
  // A revocation during a slow snapshot read must take effect before disclosure.
  if (!(await getPublicEveConversation(id))) {
    return null;
  }
  return {
    id: row.id,
    messages: sharedEveMessages(snapshot.events, receipts),
    title:
      row.title ??
      row.firstMessage.slice(
        TITLE_PREVIEW_START,
        PUBLIC_TRANSCRIPT_TITLE_PREVIEW_MAX_LENGTH
      ),
  };
};
