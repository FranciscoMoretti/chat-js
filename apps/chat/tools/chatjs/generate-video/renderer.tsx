"use client";
import { generateVideoInput, generateVideoResult } from "./schemas";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

type GenerateVideoTool = ToolRendererProps<
  typeof generateVideoInput,
  typeof generateVideoResult
>["tool"];

const GenerateVideoView = ({
  tool,
}: ReadonlyNativeSurface<{ tool: GenerateVideoTool }>): React.JSX.Element => {
  if (tool.state === "input-streaming" || tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="bg-muted-foreground/20 h-64 w-full animate-pulse rounded-lg" />
        <div className="text-muted-foreground">
          Generating video: &quot;
          {tool.input?.prompt ?? "Preparing prompt…"}
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

export const GenerateVideoRenderer = defineToolRenderer({
  inputSchema: generateVideoInput,
  outputSchema: generateVideoResult,
  render: GenerateVideoView,
});
