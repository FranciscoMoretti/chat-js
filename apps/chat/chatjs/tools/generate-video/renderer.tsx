"use client";
import { generateVideoInput, generateVideoResult } from "./schemas";
import React, { useRef } from "react";
import { ArtifactViewerActions } from "@/components/artifact-actions";
import { ArtifactDownloadAction } from "@/components/artifact-download-action";
import { VideoPlayer } from "@/components/video-player";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/chatjs/core/tools/define-renderer";
import { defineToolRenderer } from "@/chatjs/core/tools/define-renderer";

type GenerateVideoTool = ToolRendererProps<
  typeof generateVideoInput,
  typeof generateVideoResult
>["tool"];

const GenerateVideoView = ({
  tool,
}: ReadonlyNativeSurface<{ tool: GenerateVideoTool }>): React.JSX.Element => {
  const player = useRef<HTMLVideoElement>(null);
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
  const artifact = {
    fileId: output.fileId,
    url: output.videoUrl,
    name: output.prompt,
    mediaType: "video/*",
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-hidden rounded-lg border">
      <VideoPlayer ref={player} src={output.videoUrl} name={output.prompt} />
      <div className="flex items-start justify-between gap-3 px-4 pb-4">
        <p className="text-muted-foreground text-sm">
          Generated from: &quot;{output.prompt}&quot;
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <ArtifactViewerActions
            artifact={artifact}
            onOpen={() => {
              player.current?.pause();
            }}
          />
          <ArtifactDownloadAction artifact={artifact} label="Download video" />
        </div>
      </div>
    </div>
  );
};

export const GenerateVideoRenderer = defineToolRenderer({
  inputSchema: generateVideoInput,
  outputSchema: generateVideoResult,
  render: GenerateVideoView,
});
