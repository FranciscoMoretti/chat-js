"use client";

import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import type { ArtifactReference } from "@/components/artifact-actions";
import { Button } from "@/components/ui/button";

const extensions: Readonly<Record<string, string>> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
};

const downloadArtifact = async (artifact: ArtifactReference) => {
  try {
    const response = await fetch(artifact.url);
    if (!response.ok) {
      throw new Error("File request failed");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `file-${Date.now()}.${extensions[blob.type] ?? "bin"}`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Failed to download file");
  }
};

export const ArtifactDownloadAction = ({
  artifact,
  label = "Download file",
}: {
  readonly artifact: ArtifactReference;
  readonly label?: string;
}) => (
  <Button
    aria-label={label}
    title={label}
    size="icon-sm"
    variant="ghost"
    onClick={() => {
      void downloadArtifact(artifact);
    }}
  >
    <DownloadIcon size={16} />
  </Button>
);
