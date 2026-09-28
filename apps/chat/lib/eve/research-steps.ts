/* oxlint-disable eslint/func-style -- EVE compiles top-level async workflow and step declarations. */
import { Client } from "eve/client";
import type { WorkflowToolContext } from "eve/tools";

import { tools } from "../../tools/chatjs/tools";
import { getDeepResearchConfig } from "../../tools/platform/deep-research/configuration";
import { config } from "../config";
import { getEveConnectionOptions } from "./connection-options";
import { eveDocumentWriteResult } from "./document-contracts";
import { executeEveDocumentTool } from "./document-tools";
import { researchReport } from "./research-contracts";
import { sharedEveMessages } from "./shared-messages";

export async function prepareResearch(context: WorkflowToolContext) {
  "use step";
  const owner = context.session.auth.initiator;
  const selected = context.session.auth.current?.attributes.selectedTool;
  if (
    !owner ||
    context.session.parent ||
    owner.attributes.chatjsGuest === "true" ||
    (selected && selected !== "deepResearch") ||
    !config.ai.tools.deepResearch.enabled ||
    !config.ai.tools.documents.enabled ||
    !config.ai.tools.documents.types.text
  ) {
    throw new Error(
      "Deep research requires an authenticated owner and enabled text documents."
    );
  }
  if (!Object.hasOwn(tools, "webSearch")) {
    throw new Error("Deep research requires an installed webSearch tool.");
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
