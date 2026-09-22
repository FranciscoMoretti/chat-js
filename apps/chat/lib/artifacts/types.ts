import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";

export type ArtifactMetadata = object | null;

export interface UIArtifact {
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
