"use client";
import React from "react";

import { EveDocumentTool } from "@/components/eve/eve-document-tool";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";

import { ReasonSearchResearchProgress } from "./progress";
import { researchInput, researchOutput } from "./schemas";

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable eslint/no-undefined */
