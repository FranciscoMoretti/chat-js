"use client";

import { useArtifact } from "@/hooks/use-artifact";
import { useSession } from "@/providers/session-provider";
import { ArtifactPanel } from "../artifact-panel";

export function SecondaryChatPanel({
  isReadonly,
  className,
}: {
  isReadonly: boolean;
  className?: string;
}) {
  const { data: session } = useSession();
  const { artifact, origin } = useArtifact();

  return (
    <ArtifactPanel
      className={className}
      isAuthenticated={!!session?.user}
      isReadonly={isReadonly}
      key={`${origin?.view.thread.id}:${artifact.messageId}:${artifact.documentId}`}
    />
  );
}
