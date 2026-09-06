"use client";

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

  return (
    <ArtifactPanel
      className={className}
      isAuthenticated={!!session?.user}
      isReadonly={isReadonly}
    />
  );
}
