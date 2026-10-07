"use client";
import React from "react";

import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
/* oxlint-disable sort-imports -- Oxfmt groups type imports by source path, while the native rule orders their bindings differently; this import erases at runtime. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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

const GenerateVideoView = ({
  tool,
}: ReadonlyNativeSurface<{ tool: GenerateVideoTool }>) => {
  if (tool.state === "input-streaming" || tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="bg-muted-foreground/20 h-64 w-full animate-pulse rounded-lg" />
        <div className="text-muted-foreground">
          Generating video: &quot;
          {
            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading prompt from tool.input; preserve one receiver evaluation, skipped accesses and the existing "Preparing prompt…" fallback. */
            tool.input?.prompt ?? "Preparing prompt…"
            /* oxlint-enable oxc/no-optional-chaining */
          }
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

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

export const GenerateVideoRenderer = defineToolRenderer({
  inputSchema: generateVideoInput,
  outputSchema: generateVideoResult,
  render: GenerateVideoView,
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
