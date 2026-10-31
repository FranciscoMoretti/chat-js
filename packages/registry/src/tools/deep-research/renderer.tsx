"use client";
import { researchInput, researchOutput } from "./schemas";
import { EveDocumentTool } from "@/components/eve/eve-document-tool";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ReasonSearchResearchProgress } from "./progress";
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";
import type { ToolRendererProps } from "@/chatjs/core/tools/define-renderer";
import { defineToolRenderer } from "@/chatjs/core/tools/define-renderer";

export const DeepResearchRenderer = defineToolRenderer({
  inputSchema: researchInput,
  outputSchema: researchOutput,
  render: ({
    tool,
    messageId,
    isReadonly,
  }: ReadonlyNativeSurface<
    ToolRendererProps<typeof researchInput, typeof researchOutput>
  >) => {
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
              state: "completed",
              callId: tool.toolCallId,
              kind: "tool",
              label: "Create document",
              stepIndex: 0,
              name: "createTextDocument",
              type: "tool",
            }}
          />
        );
    }
    return <div className="space-y-3">{content}</div>;
  },
  renderProgress: ReasonSearchResearchProgress,
  updateSchema: ResearchUpdateSchema,
});
