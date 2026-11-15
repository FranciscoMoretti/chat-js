"use client";

import { ExpandIcon } from "lucide-react";
import { useState } from "react";
import type { ArtifactReference } from "@/components/artifact-actions";
import { Button } from "@/components/ui/button";
import { ImageModal } from "./image-modal";

export const ImageViewerAction = ({
  artifact,
}: {
  readonly artifact: ArtifactReference;
}) => {
  const [open, setOpen] = useState(false);
  if (!artifact.mediaType.startsWith("image/")) {
    return null;
  }
  return (
    <>
      <Button
        aria-label="Open image"
        title="Open image"
        size="icon-sm"
        variant="ghost"
        className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
        onClick={() => {
          setOpen(true);
        }}
      >
        <ExpandIcon size={16} />
      </Button>
      {open && (
        <ImageModal
          imageName={artifact.name}
          imageUrl={artifact.url}
          isOpen
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
};
