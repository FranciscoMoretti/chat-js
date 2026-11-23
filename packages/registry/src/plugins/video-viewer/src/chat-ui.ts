"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { ArtifactViewerActions } from "@/components/artifact-actions";
import { VideoViewerAction } from "./viewer-action";

export const chatUi = definePlugin({
  id: "video-viewer",
  slots: [slot(ArtifactViewerActions, VideoViewerAction)],
});
