"use client";
import React from "react";

import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { generateVideoInput, generateVideoResult } from "./schemas";
/* oxlint-enable eslint/sort-imports */

type GenerateVideoTool = ToolRendererProps<
  typeof generateVideoInput,
  typeof generateVideoResult
>["tool"];

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/only-export-components */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const GenerateVideoRenderer = defineToolRenderer({
  inputSchema: generateVideoInput,
  outputSchema: generateVideoResult,
  render: GenerateVideoView,
});
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
