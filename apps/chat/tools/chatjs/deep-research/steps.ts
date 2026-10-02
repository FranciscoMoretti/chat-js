/* oxlint-disable eslint/func-style -- EVE compiles top-level async workflow and step declarations. */
import { Client } from "eve/client";
import type { WorkflowToolContext } from "eve/tools";

import { getEveConnectionOptions } from "@/lib/eve/connection-options";
import { eveDocumentWriteResult } from "@/lib/eve/document-contracts";
import { executeEveDocumentTool } from "@/lib/eve/document-tools";
import { sharedEveMessages } from "@/lib/eve/shared-messages";

import { researchAvailable } from "./availability";
import { getDeepResearchConfig } from "./configuration";
import { researchReport } from "./schemas";

export async function prepareResearch(context: WorkflowToolContext) {
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
  const messages = sharedEveMessages(snapshot.events).map((message) => ({
    parts: message.parts.filter(
      (part) =>
        part.type !== "dynamic-tool" || part.toolCallId !== context.callId
    ),
    role: message.role,
  }));
  return {
    config: getDeepResearchConfig(),
    date: new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      weekday: "short",
      year: "numeric",
    }),
    messages: messages
      .map((message) => `${message.role}: ${JSON.stringify(message.parts)}`)
      .join("\n"),
    timestamp: Date.now(),
  };
}

export async function saveResearchReport(
  context: WorkflowToolContext,
  report: { title: string; content: string }
) {
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

// oxlint-disable-next-line eslint/require-await -- Durable steps must be async even for a clock read.
export async function researchCompletionTime() {
  "use step";
  return Date.now();
}
