"use client";
import React from "react";

import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { generateVideoInput, generateVideoResult } from "./schemas";
/* oxlint-enable sort-imports */

type GenerateVideoTool = ToolRendererProps<
  typeof generateVideoInput,
  typeof generateVideoResult
>["tool"];
/* oxlint-disable react/jsx-no-literals -- GenerateVideoView renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const GenerateVideoView = ({ tool }: { tool: GenerateVideoTool }) => {
  if (tool.state === "input-streaming" || tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="bg-muted-foreground/20 h-64 w-full animate-pulse rounded-lg" />
        <div className="text-muted-foreground">
          Generating video: &quot;{tool.input?.prompt ?? "Preparing prompt…"}
          &quot;
        </div>
      </div>
    );
  }

  const { output } = tool;

  return (
    <div className="flex w-full flex-col gap-4 overflow-hidden rounded-lg border">
      <video
        autoPlay
        className="h-auto w-full max-w-full"
        controls
        loop
        muted
        playsInline
        src={output.videoUrl}
      />
      <div className="p-4 pt-0">
        <p className="text-muted-foreground text-sm">
          Generated from: &quot;{output.prompt}&quot;
        </p>
      </div>
    </div>
  );
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (GenerateVideoRenderer); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

export const GenerateVideoRenderer = defineToolRenderer({
  inputSchema: generateVideoInput,
  outputSchema: generateVideoResult,
  render: GenerateVideoView,
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
