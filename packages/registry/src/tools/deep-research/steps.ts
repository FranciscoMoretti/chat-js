/* oxlint-disable eslint/func-style -- EVE compiles top-level async workflow and step declarations. */
import { Client } from "eve/client";
import type { WorkflowToolContext } from "eve/tools";

import { getEveConnectionOptions } from "@/lib/eve/connection-options";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { eveDocumentWriteResult } from "@/lib/eve/document-contracts";
/* oxlint-enable eslint/sort-imports */
import { executeEveDocumentTool } from "@/lib/eve/document-tools";
import { sharedEveMessages } from "@/lib/eve/shared-messages";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { researchAvailable } from "./availability";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { getDeepResearchConfig } from "./configuration";
/* oxlint-enable eslint/sort-imports */
import { researchReport } from "./schemas";

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
      (part): boolean =>
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
      .map(
        (message): string => `${message.role}: ${JSON.stringify(message.parts)}`
      )
      .join("\n"),
    timestamp: Date.now(),
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
// oxlint-disable-next-line eslint/require-await -- Durable steps must be async even for a clock read.
export async function researchCompletionTime(): Promise<number> {
  "use step";
  return Date.now();
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
