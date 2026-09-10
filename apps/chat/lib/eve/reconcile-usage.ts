import { Client } from "eve/client";
import { listEveOwnerBindings, ownsEveSession } from "../db/eve-queries";
import { env } from "../env";
import { ingestEveActivity } from "./activity";
import { assertEveConfigured } from "./server";
import { ingestEveUsage } from "./usage";

/** Repair missed hook writes from Eve's finite authoritative stream snapshot. */
export async function reconcileEveUsage(ownerId: string, sessionId: string) {
  assertEveConfigured();
  if (!(await ownsEveSession(ownerId, sessionId))) {
    throw new Error("Conversation not found.");
  }
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": ownerId },
  });
  const snapshot = await client.sessions
    .attach(sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  let unresolved = false;
  const latestActivity = snapshot.events.findLast(
    (event) =>
      event.type === "message.received" || event.type === "message.completed"
  );
  if (latestActivity) {
    await ingestEveActivity(ownerId, sessionId, latestActivity);
  }
  for (const event of snapshot.events) {
    const priced = await ingestEveUsage(ownerId, sessionId, event);
    if (event.type === "step.completed" && !priced) {
      unresolved = true;
    }
  }
  if (unresolved) {
    throw new Error(
      "Completed model usage needs provider cost reconciliation before starting more work."
    );
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
