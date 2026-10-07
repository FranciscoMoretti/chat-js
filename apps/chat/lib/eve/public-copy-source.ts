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

const PUBLIC_COPY_SNAPSHOT_TIMEOUT_MS = 15_000;
const PUBLIC_COPY_TITLE_PREVIEW_MAX_LENGTH = 100;

export const readPublicEveCopySource = async (
  id: string
): Promise<{
  boundaries: ReturnType<typeof eveCopyBoundaries>;
  id: string;
  ownerId: string;
  projection: ReturnType<typeof prepareEveCopyTranscript>;
  sessionId: string;
  title: string;
}> => {
  const row = await getPublicEveConversation(id);
  if (
    typeof row !== "object" ||
    typeof row.sessionId !== "string" ||
    row.sessionId === ""
  ) {
    throw new Error("Shared conversation is unavailable.");
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(row.ownerId));
  const snapshot = await client.sessions
    .attach(row.sessionId)
    .snapshot({ signal: AbortSignal.timeout(PUBLIC_COPY_SNAPSHOT_TIMEOUT_MS) });
  const current = await getPublicEveConversation(id);
  if (
    typeof current !== "object" ||
    typeof current.sessionId !== "string" ||
    current.sessionId !== row.sessionId ||
    current.ownerId !== row.ownerId
  ) {
    throw new Error("Shared conversation is unavailable.");
  }
  return {
    boundaries: eveCopyBoundaries(snapshot.events),
    id: row.id,
    ownerId: row.ownerId,
    projection: prepareEveCopyTranscript(snapshot.events),
    sessionId: row.sessionId,
    title:
      row.title ??
      // oxlint-disable-next-line no-magic-numbers -- Zero selects the first character for String#slice prefix extraction; keep the preview bounded from its beginning.
      row.firstMessage.slice(0, PUBLIC_COPY_TITLE_PREVIEW_MAX_LENGTH),
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
