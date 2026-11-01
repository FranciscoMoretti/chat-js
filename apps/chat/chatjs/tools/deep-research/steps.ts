import { Client } from "eve/client";
import type { WorkflowToolContext } from "eve/tools";
import { eveDocumentWriteResult } from "@/chatjs/core/documents/contracts";
import { executeEveDocumentTool } from "@/lib/eve/document-tools";
import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { researchAvailable } from "./availability";
import { getDeepResearchConfig } from "./configuration";
import { researchReport } from "./schemas";
import { sharedEveMessages } from "@/lib/eve/shared-messages";
import type { z } from "zod";

type Context = Readonly<
  Omit<WorkflowToolContext, "abortSignal"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;

type MessageView = Readonly<{
  parts: readonly Readonly<{ type: string; toolCallId?: string }>[];
  role: string;
}>;

// oxlint-disable-next-line eslint/func-style -- EVE 0.61 authored-workflow-directives rejects const-bound steps; record the owned transcript, config, and clock once for replay.
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
// oxlint-disable-next-line eslint/func-style -- EVE 0.61 authored-workflow-directives rejects const-bound steps; persist the document write and its completion clock together for replay.
async function saveResearchReport(
  context: Context,
  report: Readonly<z.infer<typeof researchReport>>
): Promise<{
  document: z.infer<typeof eveDocumentWriteResult>;
  completedAt: number;
}> {
  "use step";
  context.abortSignal.throwIfAborted();
  const content = researchReport.parse(report);
  const document = eveDocumentWriteResult.parse(
    await executeEveDocumentTool(
      "createTextDocument",
      {
        ...content,
        fileIds: [],
      },
      context
    )
  );
  // Record completion with the saved document so replay never reads a new clock.
  return { document, completedAt: Date.now() };
}
export { prepareResearch, saveResearchReport };
