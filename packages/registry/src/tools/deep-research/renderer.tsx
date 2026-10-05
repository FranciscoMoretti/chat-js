"use client";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveDocumentTool } from "@/components/eve/eve-document-tool";
/* oxlint-enable sort-imports */
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ReasonSearchResearchProgress } from "./progress";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { researchInput, researchOutput } from "./schemas";
/* oxlint-enable sort-imports */

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */

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

/* oxlint-enable eslint/no-undefined */
