import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";

type ArtifactMetadata = object | null;

interface UIArtifact {
  content: string;
  conversationId?: string;
  followLive?: boolean;
  previewCallId?: string;
  date?: string;
  documentId: string;
  isVisible: boolean;
  kind: ArtifactKind;
  messageId: string;
  revisionId?: string;
  status: "streaming" | "idle";
  title: string;
}
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ArtifactMetadata, UIArtifact); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ArtifactMetadata, UIArtifact };
/* oxlint-enable import/no-named-export */
