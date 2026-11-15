"use client";

import { ExpandIcon } from "lucide-react";
import { useState } from "react";
import type { ArtifactReference } from "@/components/artifact-actions";
import { ArtifactDownloadAction } from "@/components/artifact-download-action";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export const VideoViewerAction = ({
  artifact,
  onOpen,
}: {
  readonly artifact: ArtifactReference;
  readonly onOpen?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  if (!artifact.mediaType.startsWith("video/")) {
    return null;
  }
  return (
    <>
      <Button
        aria-label="Open video"
        title="Open video"
        size="icon-sm"
        variant="ghost"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <ExpandIcon size={16} />
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-5xl sm:max-w-5xl">
            <DialogTitle className="pe-8">Video preview</DialogTitle>
            <DialogDescription className="line-clamp-2">
              {artifact.name}
            </DialogDescription>
            <VideoPlayer
              src={artifact.url}
              name={artifact.name}
              className="rounded-md"
            />
            <div className="flex justify-end">
              <ArtifactDownloadAction
                artifact={artifact}
                label="Download video"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
