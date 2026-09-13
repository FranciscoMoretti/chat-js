"use client";

import type { ChatMessage } from "@/lib/ai/types";

export type GenerateVideoTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-generateVideo" }
>;

export function GenerateVideo({ tool }: { tool: GenerateVideoTool }) {
  if (tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="bg-muted-foreground/20 h-64 w-full animate-pulse rounded-lg" />
        <div className="text-muted-foreground">
          Generating video: &quot;{tool.input.prompt}&quot;
        </div>
      </div>
    );
  }

  const output = tool.output;
  if (!output) {
    const fallbackPrompt = tool.input?.prompt ?? "the same idea";

    return (
      <div className="text-muted-foreground flex w-full flex-col items-center justify-center gap-2 rounded-lg border p-4 text-sm">
        <div>Couldn&apos;t generate video.</div>
        <div className="text-xs">
          Try again with a different prompt: &quot;{fallbackPrompt}&quot;
        </div>
      </div>
    );
  }

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
}
