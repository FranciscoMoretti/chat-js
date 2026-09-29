/* oxlint-disable eslint/func-style -- EVE compiles durable step declarations. */
import { Client } from "eve/client";
import type { WorkflowToolContext } from "eve/tools";

import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { toolOutputSchema } from "@/lib/eve/tool-result";
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";

export async function researchSearchUpdates(context: WorkflowToolContext) {
  "use step";
  const owner = context.session.auth.initiator;
  if (!owner) {
    throw new Error("Research progress requires an authenticated owner.");
  }
  const client = new Client(getEveConnectionOptions(owner.principalId));
  const options = { signal: context.abortSignal };
  const root = await client.sessions
    .attach(context.session.id)
    .snapshot(options);
  const children = root.events.flatMap((event) =>
    event.type === "subagent.called" &&
    !event.data.remote &&
    event.data.name === "researcher" &&
    event.data.turnId === context.session.turn.id &&
    // EVE prefixes workflow agent invocation IDs with their owning tool call ID.
    event.data.callId.startsWith(`${context.callId}:`)
      ? [event.data.childSessionId]
      : []
  );
  const snapshots = await Promise.all(
    children.map((sessionId) =>
      client.sessions.attach(sessionId).snapshot(options)
    )
  );
  return snapshots.flatMap((snapshot) =>
    snapshot.events.flatMap((event) => {
      if (
        event.type !== "action.result" ||
        event.data.result.kind !== "tool-result"
      ) {
        return [];
      }
      const receipt = toolOutputSchema.safeParse(event.data.result.output);
      if (!receipt.success) {
        return [];
      }
      return (receipt.data.updates ?? []).flatMap((value) => {
        const update = ResearchUpdateSchema.safeParse(value);
        return update.success && update.data.type === "web"
          ? [update.data]
          : [];
      });
    })
  );
}
