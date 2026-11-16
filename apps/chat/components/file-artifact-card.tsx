"use client";

import { FileIcon } from "lucide-react";
import type { ArtifactReference } from "./artifact-actions";
import { ArtifactViewerActions } from "./artifact-actions";
import { ArtifactDownloadAction } from "./artifact-download-action";

/** Published and uploaded files can share this presentation; access stays server-side. */
export const FileArtifactCard = ({
  artifact,
}: {
  readonly artifact: ArtifactReference & { readonly size: number };
}) => (
  <div className="bg-card flex min-w-0 items-center gap-3 rounded-lg border p-4">
    <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
      <FileIcon className="size-5" aria-hidden="true" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium" title={artifact.name}>
        {artifact.name}
      </p>
      <p className="text-muted-foreground text-xs">
        {artifact.size < 1024
          ? `${artifact.size} B`
          : `${(artifact.size / 1024).toLocaleString("en-US", { maximumFractionDigits: 1 })} KB`}
      </p>
    </div>
    <div className="flex shrink-0 items-center gap-1">
      <ArtifactViewerActions artifact={artifact} />
      <ArtifactDownloadAction
        artifact={artifact}
        filename={artifact.name}
        label={`Download ${artifact.name}`}
      />
    </div>
  </div>
);
