"use client";

import type { EveMessagePart } from "eve/client";
import { z } from "zod";

import { toolOutputSchema } from "@/lib/eve/tool-result";
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";

import { ResearchUpdates } from "../part/message-annotations";
import { EveDocumentTool } from "./eve-document-tool";

const answer = z.object({ answer: z.string() });
const failure = z.object({ error: z.string() });

export const EveResearchResult = ({
  part,
  messageId,
  isReadonly,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
}) => {
  if (part.state === "output-error") {
    return <p role="alert">{part.errorText}</p>;
  }
  if (part.state === "output-denied") {
    return <p>Research declined.</p>;
  }
  if (part.state !== "output-available") {
    return <output>Researching…</output>;
  }
  const result = toolOutputSchema.safeParse(part.output);
  if (!result.success) {
    return <p role="alert">This research result could not be displayed.</p>;
  }
  const updates = (result.data.updates ?? []).flatMap((value) => {
    const parsed = ResearchUpdateSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
  if (result.data.status === "error") {
    return <p role="alert">{result.data.error}</p>;
  }
  const problem = failure.safeParse(result.data.output);
  const clarification = answer.safeParse(result.data.output);
  const report = z
    .object({ format: z.literal("report") })
    .safeParse(result.data.output);
  let content = <output>Researching…</output>;
  if (problem.success) {
    content = <p role="alert">{problem.data.error}</p>;
  } else if (clarification.success) {
    content = <p>{clarification.data.answer}</p>;
  } else if (report.success) {
    content = (
      <EveDocumentTool
        isReadonly={isReadonly}
        messageId={messageId}
        part={{
          ...part,
          output: result.data.output,
          toolName: "createTextDocument",
        }}
      />
    );
  }
  return (
    <div className="space-y-3">
      <ResearchUpdates updates={updates} />
      {content}
    </div>
  );
};
