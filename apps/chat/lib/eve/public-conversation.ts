import { Client } from "eve/client";
import { assertEveConfigured } from "./server";
import { getEveConnectionOptions } from "./connection-options";
import { getPublicEveConversation } from "@/lib/db/eve-queries";
import { sharedEveMessages } from "./shared-messages";

const PUBLIC_TRANSCRIPT_SNAPSHOT_TIMEOUT_MS = 15_000;
const PUBLIC_TRANSCRIPT_TITLE_PREVIEW_MAX_LENGTH = 100;
const TITLE_PREVIEW_START = 0;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getPublicEveTranscript); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve getPublicEveTranscript's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable unicorn/no-null -- An unavailable public transcript has the established null result contract. */
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
  // A revocation during a slow snapshot read must take effect before disclosure.
  if (!(await getPublicEveConversation(id))) {
    return null;
  }
  return {
    id: row.id,
    messages: sharedEveMessages(snapshot.events),
    title:
      row.title ??
      row.firstMessage.slice(
        TITLE_PREVIEW_START,
        PUBLIC_TRANSCRIPT_TITLE_PREVIEW_MAX_LENGTH
      ),
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable unicorn/no-null */
