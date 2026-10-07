"use client";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveDocumentTool } from "@/components/eve/eve-document-tool";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime import evaluation order while placing erased type imports beside their helper. */
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ReasonSearchResearchProgress } from "./progress";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { researchInput, researchOutput } from "./schemas";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (DeepResearchRenderer); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- DeepResearchRenderer renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */

/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */

/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
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
    // oxlint-disable-next-line no-ternary -- Keep result as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    const result = tool.state === "output-available" ? tool.output : undefined;
    let content = <output>Researching…</output>;
    if (result && "format" in result) {
      content =
        // oxlint-disable-next-line no-ternary -- Keep = operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */

/* oxlint-enable eslint/no-undefined */
