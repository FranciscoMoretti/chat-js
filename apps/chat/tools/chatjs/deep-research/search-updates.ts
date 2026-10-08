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
type StreamEvent = Snapshot["events"][number];
type InvocationData = Extract<StreamEvent, { type: "subagent.called" }>["data"];
type InvocationEventView =
  | Readonly<{
      type: "subagent.called";
      data: Readonly<
        Pick<
          InvocationData,
          "callId" | "childSessionId" | "name" | "turnId"
        > & {
          remote?: Readonly<NonNullable<InvocationData["remote"]>>;
        }
      >;
    }>
  | Readonly<{ type: Exclude<StreamEvent["type"], "subagent.called"> }>;
type ActionResult = Extract<
  StreamEvent,
  { type: "action.result" }
>["data"]["result"];
type ActionEventView =
  | Readonly<{
      type: "action.result";
      data: Readonly<{
        result:
          | Readonly<{ kind: "tool-result"; output: unknown }>
          | Readonly<{ kind: Exclude<ActionResult["kind"], "tool-result"> }>;
      }>;
    }>
  | Readonly<{ type: Exclude<StreamEvent["type"], "action.result"> }>;
type SnapshotView = Readonly<{ events: readonly ActionEventView[] }>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve readResearchSnapshots's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (researchSearchUpdates); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve researchSearchUpdates's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line eslint/func-style -- EVE's directive compiler requires this durable researchSearchUpdates step to be a top-level named async function declaration.
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
  const children = root.events.flatMap((event: InvocationEventView) => {
    if (
      event.type === "subagent.called" &&
      !event.data.remote &&
      event.data.name === "researcher" &&
      event.data.turnId === context.session.turn.id &&
      // EVE prefixes workflow agent invocation IDs with their owning tool call ID.
      event.data.callId.startsWith(`${context.callId}:`)
    ) {
      return [event.data.childSessionId];
    }
    return [];
  });
  const snapshots = await readResearchSnapshots(client, children, options);
  return snapshots.flatMap((snapshot: SnapshotView) =>
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
