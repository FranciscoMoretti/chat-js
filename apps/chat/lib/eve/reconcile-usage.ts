import { Client, type MessageStreamEvent } from "eve/client";
import { advanceEveUsageCursor, getEveUsageCursor } from "../db/eve-billing";
import { listEveOwnerBindings } from "../db/eve-queries";
import { env } from "../env";
import { ingestEveActivity } from "./activity";
import { assertEveConfigured } from "./server";
import { ingestEveUsage } from "./usage";

/** Repair missed hooks from the unread suffix of Eve's authoritative stream. */
export async function reconcileEveUsage(ownerId: string, sessionId: string) {
  assertEveConfigured();
  const startIndex = await getEveUsageCursor(ownerId, sessionId);
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": ownerId },
  });
  const session = client.sessions.attach(sessionId);
  let streamIndex = startIndex;
  let unresolved = false;
  let latestActivity: MessageStreamEvent | undefined;
  for await (const event of session.stream({
    startIndex,
    follow: false,
    signal: AbortSignal.timeout(15_000),
  })) {
    streamIndex += 1;
    if (
      event.type === "message.received" ||
      event.type === "message.completed"
    ) {
      latestActivity = event;
    }
    const priced = await ingestEveUsage(ownerId, sessionId, event);
    if (
      (event.type === "step.completed" || event.type === "action.result") &&
      priced === false
    ) {
      unresolved = true;
    }
  }
  if (latestActivity) {
    await ingestEveActivity(ownerId, sessionId, latestActivity);
  }
  if (unresolved) {
    throw new Error(
      "Completed usage needs provider cost reconciliation before starting more work."
    );
  }
  if (streamIndex > startIndex) {
    await advanceEveUsageCursor(ownerId, sessionId, streamIndex);
  }
}

export async function reconcileEveOwnerUsage(ownerId: string) {
  const bindings = await listEveOwnerBindings(ownerId);
  if (bindings.some((row) => row.state !== "bound" || !row.sessionId)) {
    throw new Error(
      "Resolve uncertain session creation before starting more work."
    );
  }
  for (let offset = 0; offset < bindings.length; offset += 4) {
    await Promise.all(
      bindings.slice(offset, offset + 4).map(async (row) => {
        if (row.sessionId) {
          await reconcileEveUsage(ownerId, row.sessionId);
        }
      })
    );
  }
}
