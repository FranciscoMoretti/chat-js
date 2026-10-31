import { Client } from "eve/client";
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";
import type { WebSearchUpdate } from "@/tools/platform/research-updates-schema";
import type { WorkflowToolContext } from "eve/tools";
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { toolOutputSchema } from "@/lib/eve/tool-result";

type Context = Readonly<
  Omit<WorkflowToolContext, "abortSignal"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

type Snapshot = Awaited<
  ReturnType<ReturnType<Client["sessions"]["attach"]>["snapshot"]>
>;
const readResearchSnapshots = async (
  client: Readonly<{ sessions: Readonly<Pick<Client["sessions"], "attach">> }>,
  sessionIds: readonly string[],
  options: Readonly<{ signal: Readonly<AbortSignal> }>
): Promise<Snapshot[]> => {
  const requests: Promise<Snapshot>[] = [];
  for (const sessionId of sessionIds) {
    requests.push(client.sessions.attach(sessionId).snapshot(options));
  }
  return await Promise.all(requests);
};
// oxlint-disable-next-line eslint/func-style -- EVE 0.61 authored-workflow-directives rejects const-bound steps; record owned child search snapshots so replay never rereads live evidence.
export async function researchSearchUpdates(
  context: Context
): Promise<WebSearchUpdate[]> {
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
  const children = root.events.flatMap((event) => {
    if (
      event.type === "child.opened" &&
      event.data.stream ===
        `/eve/v1/session/${encodeURIComponent(event.data.sessionId)}/stream` &&
      event.data.name === "researcher" &&
      event.scope?.turnId === context.session.turn.id &&
      "callId" in event.data.owner &&
      event.data.owner.callId === context.callId
    ) {
      return [event.data.sessionId];
    }
    return [];
  });
  const snapshots = await readResearchSnapshots(client, children, options);
  return snapshots.flatMap((snapshot) =>
    snapshot.events.flatMap((event) => {
      if (event.type !== "call.settled") {
        return [];
      }
      const receipt = toolOutputSchema.safeParse(event.data.output);
      if (!receipt.success) {
        return [];
      }
      return (receipt.data.updates ?? []).flatMap((value: unknown) => {
        const update = ResearchUpdateSchema.safeParse(value);

        if (update.success && update.data.type === "web") {
          return [update.data];
        }
        return [];
      });
    })
  );
}
