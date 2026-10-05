import { Client } from "eve/client";
import type { WorkflowToolContext } from "eve/tools";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveDocumentWriteResult } from "@/lib/eve/document-contracts";
/* oxlint-enable sort-imports */
import { executeEveDocumentTool } from "@/lib/eve/document-tools";
import { sharedEveMessages } from "@/lib/eve/shared-messages";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { researchAvailable } from "./availability";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getDeepResearchConfig } from "./configuration";
/* oxlint-enable sort-imports */
import { researchReport } from "./schemas";

type Context = Readonly<
  Omit<WorkflowToolContext, "abortSignal"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

type MessageView = Readonly<{
  parts: readonly Readonly<{ type: string; toolCallId?: string }>[];
  role: string;
}>;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve prepareResearch's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line eslint/func-style -- EVE's directive compiler requires top-level async function declarations so this durable prepareResearch step keeps its stable name and replay boundary.
async function prepareResearch(context: Context): Promise<{
  config: ReturnType<typeof getDeepResearchConfig>;
  date: string;
  messages: string;
  timestamp: number;
}> {
  "use step";
  const owner = context.session.auth.initiator;
  if (!owner || !researchAvailable(context.session)) {
    throw new Error(
      "Deep research requires an authenticated owner, installed text documents, and installed webSearch."
    );
  }
  context.abortSignal.throwIfAborted();
  const client = new Client(getEveConnectionOptions(owner.principalId));
  const snapshot = await client.sessions
    .attach(context.session.id)
    .snapshot({ signal: context.abortSignal });
  const messages = sharedEveMessages(snapshot.events).map(
    (message: MessageView) => ({
      parts: message.parts.filter(
        (part): boolean =>
          part.type !== "dynamic-tool" || part.toolCallId !== context.callId
      ),
      role: message.role,
    })
  );
  return {
    config: getDeepResearchConfig(),
    date: new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      weekday: "short",
      year: "numeric",
    }),
    messages: messages
      .map(
        (message: MessageView): string =>
          `${message.role}: ${JSON.stringify(message.parts)}`
      )
      .join("\n"),
    timestamp: Date.now(),
  };
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveResearchReport's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line eslint/func-style -- EVE's directive compiler requires a top-level async function declaration for the durable saveResearchReport step.
async function saveResearchReport(
  context: Context,
  report: Readonly<z.infer<typeof researchReport>>
): Promise<z.infer<typeof eveDocumentWriteResult>> {
  "use step";
  context.abortSignal.throwIfAborted();
  const content = researchReport.parse(report);
  return eveDocumentWriteResult.parse(
    await executeEveDocumentTool(
      "createTextDocument",
      {
        ...content,
        fileIds: [],
      },
      context
    )
  );
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve researchCompletionTime's required Promise and rejection contract. researchCompletionTime is a named durable use-step function returning Promise<number>; the directive compiler requires async even though the clock read is synchronous. */
// oxlint-disable-next-line eslint/func-style, eslint/require-await -- EVE requires this clock read to remain a named async durable step; a synchronous or arrow function is rejected by its directive compiler.
async function researchCompletionTime(): Promise<number> {
  "use step";
  return Date.now();
}
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (prepareResearch, saveResearchReport, researchCompletionTime); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { prepareResearch, saveResearchReport, researchCompletionTime };
/* oxlint-enable import/no-named-export */
