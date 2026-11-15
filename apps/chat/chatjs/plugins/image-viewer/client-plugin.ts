"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { ArtifactViewerActions } from "@/components/artifact-actions";
import { ImageViewerAction } from "./viewer-action";

export const imageViewerClient = definePlugin({
  id: "image-viewer",
  slots: [slot(ArtifactViewerActions, ImageViewerAction)],
});
