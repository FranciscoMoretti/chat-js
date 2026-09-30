"use client";

import { EveDocumentTool } from "@/components/eve/eve-document-tool";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";

import { ReasonSearchResearchProgress } from "./progress";
import { researchInput, researchOutput } from "./schemas";

export const DeepResearchRenderer = defineToolRenderer({
  inputSchema: researchInput,
  outputSchema: researchOutput,
  render: ({ tool, messageId, isReadonly }) => {
    const result = tool.state === "output-available" ? tool.output : undefined;
    let content = <output>Researching…</output>;
    if (result && "format" in result) {
      content =
        result.format === "clarifying_questions" ? (
          <p>{result.answer}</p>
        ) : (
          <EveDocumentTool
            isReadonly={isReadonly}
            messageId={messageId}
            part={{
              input: {},
              output: result,
              state: "output-available",
              toolCallId: tool.toolCallId,
              toolName: "createTextDocument",
              type: "dynamic-tool",
            }}
          />
        );
    }
    return <div className="space-y-3">{content}</div>;
  },
  renderProgress: ReasonSearchResearchProgress,
  updateSchema: ResearchUpdateSchema,
});
