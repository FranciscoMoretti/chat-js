"use client";
import { researchInput, researchOutput } from "./schemas";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { ReasonSearchResearchProgress } from "./progress";
import { ResearchUpdateSchema } from "@/tools/platform/research-updates-schema";
import type { ToolRendererProps } from "@/chatjs/core/tools/define-renderer";
import { defineToolRenderer } from "@/chatjs/core/tools/define-renderer";
import { FileArtifactCard } from "@/components/file-artifact-card";

export const DeepResearchRenderer = defineToolRenderer({
  inputSchema: researchInput,
  outputSchema: researchOutput,
  render: ({
    tool,
  }: ReadonlyNativeSurface<
    ToolRendererProps<typeof researchInput, typeof researchOutput>
  >) => {
    const result = tool.state === "output-available" ? tool.output : undefined;
    let content = <output>Researching…</output>;
    if (result && result.format !== "progress") {
      content =
        result.format === "clarifying_questions" ? (
          <p>{result.answer}</p>
        ) : (
          <div className="space-y-1">
            <p className="font-medium">{result.title}</p>
            {result.artifact ? (
              <FileArtifactCard artifact={result.artifact} />
            ) : (
              <p className="text-muted-foreground text-sm">
                Research complete. Report saved in the agent workspace.
              </p>
            )}
          </div>
        );
    }
    return <div className="space-y-3">{content}</div>;
  },
  renderProgress: ReasonSearchResearchProgress,
  updateSchema: ResearchUpdateSchema,
});
